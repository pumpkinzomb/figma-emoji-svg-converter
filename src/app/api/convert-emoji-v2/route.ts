import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { Font, FontEditor } from "fonteditor-core";
import * as wawoff2 from "wawoff2";
import { LRUCache } from "lru-cache";

interface FontReadOptions {
  type: FontEditor.FontType;
  hinting: boolean;
  compound2simple: boolean;
  inflate?: (deflatedData: number[]) => number[];
  combinePath: boolean;
}

interface OptimizeResult {
  result: true | { repeat: number[] };
}

// 이모지 디버그 정보 타입 정의
interface EmojiDebugInfo {
  emoji: string;
  length: number;
  codePoints: string[];
  codePointsStr: string;
}

// 디버그 정보 타입 정의
interface DebugInfo {
  emojiDetails: EmojiDebugInfo;
  cacheHit?: boolean;
  processingTimeMs?: number;
  fontSubsetCreated?: boolean;
  fontBase64Length?: number;
  fontSubsetError?: string;
  hasFontSubset?: boolean;
  [key: string]: any;
}

// 이모지 서브셋 캐시 - LRU 캐시로 최대 5개 항목만 저장
const emojiSubsetCache = new LRUCache<string, string>({
  max: 5, // 최대 5개 이모지만 캐싱
  ttl: 1000 * 60 * 60 * 6, // 6시간 후 만료
});

// 이모지 디버깅 헬퍼 함수
const debugEmoji = (emoji: string): EmojiDebugInfo => {
  // 문자열을 루프 가능한 형태로 변환하기 위해 Array.from 사용
  const codePoints = Array.from(emoji).map((char) => {
    const hex = char.codePointAt(0)?.toString(16).toUpperCase();
    return `U+${hex}`;
  });

  return {
    emoji,
    length: emoji.length,
    codePoints,
    codePointsStr: codePoints.join(" "),
  };
};

// Fontkit을 사용하여 코드포인트에서 글리프 ID 찾기
function getGlyphIdsForEmoji(font: any, emoji: string) {
  const glyphIds: number[] = [];
  const codePoints: number[] = [];

  // 이모지에서 코드포인트 추출
  for (let i = 0; i < emoji.length; i++) {
    const cp = emoji.codePointAt(i);
    if (cp) {
      codePoints.push(cp);
      // 서로게이트 페어인 경우 다음 코드 유닛 건너뛰기
      if (cp > 0xffff) {
        i++;
      }
    }
  }

  // 코드포인트에서 글리프 ID 찾기
  for (const cp of codePoints) {
    try {
      const gid = font.glyphForCodePoint(cp).id;
      if (gid !== undefined && !glyphIds.includes(gid)) {
        glyphIds.push(gid);
      }
    } catch (e) {
      console.warn(
        `Warning: Could not find glyph for code point U+${cp
          .toString(16)
          .toUpperCase()}`
      );
    }
  }

  // 조합 이모지의 경우 전체 시퀀스에 대한 글리프도 찾기
  if (codePoints.length > 1) {
    try {
      const str = String.fromCodePoint(...codePoints);
      const run = font.layout(str);

      if (run && run.glyphs) {
        for (const glyph of run.glyphs) {
          if (glyph.id !== undefined && !glyphIds.includes(glyph.id)) {
            glyphIds.push(glyph.id);
          }
        }
      }
    } catch (e) {
      console.warn(
        `Warning: Error processing combined emoji sequence: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  return {
    glyphIds,
    codePoints,
  };
}

// 폰트 서브셋팅 함수 - 원래 worker 스크립트에서 수행하던 작업을 직접 수행
async function createEmojiSubset(emoji: string): Promise<string> {
  try {
    // 폰트 경로
    const fontPath = path.join(
      process.cwd(),
      "public/fonts/NotoColorEmoji-Regular.ttf"
    );

    // 작업 디렉토리 확인 (배포 환경에서는 메모리에서만 작업)
    let outputPath = "";
    const isDevEnv = process.env.NODE_ENV === "development";

    if (isDevEnv) {
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      outputPath = path.join(tempDir, `emoji-${Date.now()}.woff2`);
    }

    // 폰트 파일 존재 확인
    if (!fs.existsSync(fontPath)) {
      throw new Error(`Font file not found: ${fontPath}`);
    }

    console.log(`Loading font from: ${fontPath}`);

    // 폰트 데이터 로드
    const fontData = fs.readFileSync(fontPath);

    // Fontkit으로 폰트 파싱
    const font = fontkit.create(fontData);
    console.log(`Font loaded: ${font.fullName}`);

    // 이모지에 대한 글리프 ID 가져오기
    const { glyphIds, codePoints } = getGlyphIdsForEmoji(font, emoji);

    console.log(`Found ${glyphIds.length} glyph IDs for emoji`);
    console.log(`Glyph IDs: ${glyphIds.join(", ")}`);
    console.log(
      `Code points: ${codePoints
        .map((cp) => "U+" + cp.toString(16).toUpperCase())
        .join(", ")}`
    );

    // fonteditor-core로 폰트 서브셋팅
    // 중요: 이 부분이 원래 코드의 핵심 기능
    const fontObject = Font.create(fontData, {
      type: "ttf",
      hinting: true,
      compound2simple: false, // 복합 글리프 유지
      // inflate 속성은 생략 (선택적 속성으로 처리)
      combinePath: false, // 경로 최적화 안 함
    } as FontReadOptions);

    // 서브셋 옵션 설정
    const subsetOpts = {
      subset: glyphIds, // 유지할 글리프 ID 목록
      dump: true, // 필요하지 않은 테이블 정리
      transform: false, // 변환 없음
    };

    // OptimizeResult 별도 정의
    const optimizeResult: OptimizeResult = {
      result: true,
    };

    // 서브셋 생성
    fontObject.optimize({ ...subsetOpts, ...optimizeResult });
    console.log("Font subset created");

    // TTF 버퍼로 변환
    const ttfBuffer = fontObject.write({
      type: "ttf",
      hinting: true,
    });

    // ttfBuffer may be ArrayBuffer or string, handle both cases
    const ttfBufferArray =
      ttfBuffer instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(ttfBuffer))
        : typeof ttfBuffer === "string"
        ? Buffer.from(ttfBuffer)
        : Buffer.from(ttfBuffer as any);

    console.log(`TTF buffer size: ${ttfBufferArray.byteLength} bytes`);

    // 개발 환경에서만 TTF 파일 저장 (디버깅용)
    let ttfPath = "";
    if (isDevEnv && outputPath) {
      ttfPath = outputPath.replace(/\.[^.]+$/, ".ttf");
      fs.writeFileSync(ttfPath, ttfBufferArray);
      console.log(`TTF file saved to: ${ttfPath}`);
    }

    // WOFF2로 변환
    const woff2Buffer = await wawoff2.compress(ttfBufferArray);
    console.log(`WOFF2 buffer size: ${woff2Buffer.length} bytes`);

    // 개발 환경에서 TTF 파일 삭제 (불필요한 디스크 공간 확보)
    if (isDevEnv && ttfPath && fs.existsSync(ttfPath)) {
      fs.unlinkSync(ttfPath);
      console.log(`TTF file deleted: ${ttfPath}`);
    }

    // Base64 인코딩
    const base64Data = Buffer.from(woff2Buffer).toString("base64");
    console.log(`Base64 data length: ${base64Data.length} characters`);

    return base64Data;
  } catch (error) {
    console.error("Error creating emoji font:", error);
    throw error;
  }
}

// SVG 생성 함수
const createSvgWithFont = (
  emoji: string,
  fontFamily: string = "EmojiSubset",
  width: number = 72,
  height: number = 72,
  fontFileName: string = "emoji-font.woff2"
): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style type="text/css">
      @font-face {
        font-family: '${fontFamily}';
        src: url('./${fontFileName}') format('woff2');
        font-display: swap;
      }
    </style>
  </defs>
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; font-size: ${
      height * 0.7
    }px; font-family: '${fontFamily}';">${emoji}</div>
  </foreignObject>
</svg>`;
};

// 폴백 SVG 생성 함수
const createSimpleSvg = (
  emoji: string,
  width: number = 72,
  height: number = 72
): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; font-size: ${
      height * 0.7
    }px; font-family: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;">${emoji}</div>
  </foreignObject>
</svg>`;
};

export async function POST(request: NextRequest) {
  try {
    const { emoji, width = 72, height = 72 } = await request.json();
    console.log("Received emoji:", emoji);
    console.log(`SVG dimensions: ${width}x${height}`);

    // 수신한 이모지의 코드포인트 정보 로깅
    const emojiInfo = debugEmoji(emoji);
    console.log("Received emoji details:", emojiInfo);

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    let fontBase64 = "";
    const fontFamily = "Noto Color Emoji";
    const debugInfo: DebugInfo = {
      emojiDetails: emojiInfo,
    };

    // 캐시에서 먼저 확인
    if (emojiSubsetCache.get(emoji)) {
      console.log("Cache hit for emoji:", emoji);
      fontBase64 = emojiSubsetCache.get(emoji) || "";
      debugInfo.cacheHit = true;
    } else {
      console.log("Cache miss for emoji:", emoji);
      debugInfo.cacheHit = false;

      try {
        // 폰트 서브셋팅 직접 실행
        const startTime = Date.now();
        const subsetBase64 = await createEmojiSubset(emoji);
        const endTime = Date.now();
        debugInfo.processingTimeMs = endTime - startTime;

        if (subsetBase64) {
          fontBase64 = subsetBase64;
          emojiSubsetCache.set(emoji, fontBase64);
          debugInfo.fontSubsetCreated = true;
          debugInfo.fontBase64Length = fontBase64.length;
        } else {
          throw new Error("Font subsetting returned null");
        }
      } catch (error) {
        console.error("Error in font subsetting:", error);
        debugInfo.fontSubsetError =
          error instanceof Error ? error.message : String(error);

        // 폰트 처리 실패 시 간단한 SVG 생성으로 폴백
        return NextResponse.json({
          svgContent: createSimpleSvg(emoji, width, height),
          fontProcessed: false,
          fontFamily: fontFamily,
          debug: debugInfo,
        });
      }
    }

    // 폰트 처리가 성공했는지 확인
    const hasFontSubset = fontBase64 !== "";
    debugInfo.hasFontSubset = hasFontSubset;

    if (!hasFontSubset) {
      return NextResponse.json({
        svgContent: createSimpleSvg(emoji, width, height),
        fontProcessed: false,
        fontFamily: fontFamily,
        debug: debugInfo,
      });
    }

    // 고유한 폰트 파일 이름 생성
    const fontFileName = `emoji-font-${Date.now()}.woff2`;

    // SVG 생성
    const svgContent = createSvgWithFont(
      emoji,
      "EmojiSubset",
      width,
      height,
      fontFileName
    );

    return NextResponse.json({
      svgContent,
      fontData: fontBase64,
      fontFileName,
      fontProcessed: true,
      fontFamily: "EmojiSubset",
      debug: debugInfo,
    });
  } catch (error) {
    console.error("Error processing emoji:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process emoji",
        debug: { error: String(error) },
      },
      { status: 500 }
    );
  }
}
