import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

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

// 이모지 서브셋 캐시
const emojiSubsetCache: Record<string, string> = {};

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

// 워커 스크립트 실행 함수
const runWorkerScript = async (emoji: string): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    // 작업 디렉토리 확인
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 출력 파일 경로
    const outputPath = path.join(tempDir, `emoji-${Date.now()}.woff2`);

    // 워커 스크립트 경로
    const workerPath = path.join(process.cwd(), "scripts/emoji-worker.mjs");

    // 이모지를 Base64로 인코딩
    const emojiBase64 = Buffer.from(emoji).toString("base64");

    // 폰트 경로
    const fontPath = path.join(
      process.cwd(),
      "public/fonts/NotoColorEmoji-Regular.ttf"
    );

    // 경로 로깅
    console.log("Worker Path:", workerPath);
    console.log("Font Path:", fontPath);
    console.log("Output Path:", outputPath);
    console.log("Emoji Details:", debugEmoji(emoji));

    // 폰트 파일 존재 확인
    if (!fs.existsSync(fontPath)) {
      console.error("Font file not found at:", fontPath);
      return reject(new Error("Font file not found"));
    }

    // 워커 프로세스 실행
    const worker = spawn("node", [
      workerPath,
      fontPath,
      outputPath,
      emojiBase64,
    ]);

    let stdoutData = "";
    let stderrData = "";

    worker.stdout.on("data", (data) => {
      stdoutData += data.toString();
      console.log("Worker stdout:", data.toString());
    });

    worker.stderr.on("data", (data) => {
      stderrData += data.toString();
      console.error("Worker stderr:", data.toString());
    });

    worker.on("close", (code) => {
      if (code !== 0) {
        console.error("Worker process error:", stderrData);
        return reject(new Error(`Worker process exited with code ${code}`));
      }

      try {
        // 생성된 파일 확인
        if (!fs.existsSync(outputPath)) {
          return reject(new Error("Output file not created"));
        }

        // 생성된 파일 정보 로깅
        const fileStats = fs.statSync(outputPath);
        console.log(`WOFF2 file size: ${fileStats.size} bytes`);

        // 파일 유효성 검사 - 파일의 시그니처 확인 (WOFF2는 'wOF2'로 시작)
        const fileBuffer = fs.readFileSync(outputPath);
        if (fileBuffer.length < 4) {
          return reject(new Error("Generated file is too small to be valid"));
        }

        const fileSignature = fileBuffer.slice(0, 4).toString("hex");
        const isValidWOFF2 = fileSignature === "774f4632";
        console.log(
          `File signature: ${fileSignature}, Is valid WOFF2: ${isValidWOFF2}`
        );

        if (!isValidWOFF2) {
          return reject(new Error("Generated file is not a valid WOFF2 file"));
        }

        // 생성된 파일 읽기
        const fileData = fs.readFileSync(outputPath);
        const base64Data = fileData.toString("base64");

        // Base64 길이 로깅
        console.log(`Base64 data length: ${base64Data.length} characters`);

        // 디버깅을 위해 파일 유지 (임시)
        console.log(`WOFF2 file available at: ${outputPath}`);

        // 결과를 특정 경로에 SVG로 저장 (디버깅용)
        const testSvgPath = path.join(tempDir, `test-emoji-${Date.now()}.svg`);
        const svgContent = createSvgWithFont(emoji, base64Data);
        fs.writeFileSync(testSvgPath, svgContent);
        console.log(`Test SVG created at: ${testSvgPath}`);

        resolve(base64Data);
      } catch (error) {
        console.error("Error processing output file:", error);
        reject(error);
      }
    });

    worker.on("error", (error) => {
      console.error("Worker spawn error:", error);
      reject(error);
    });
  });
};

// SVG 생성 함수
const createSvgWithFont = (emoji: string, fontBase64: string): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">
  <defs>
    <style type="text/css">
      @font-face {
        font-family: 'EmojiSubset';
        src: url(data:font/woff2;base64,${fontBase64}) format('woff2');
        font-display: swap;
      }
    </style>
  </defs>
  <foreignObject x="0" y="0" width="72" height="72">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; font-size: 50px; font-family: 'EmojiSubset';">${emoji}</div>
  </foreignObject>
</svg>`;
};

// 폴백 SVG 생성 함수
const createSimpleSvg = (emoji: string): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">
  <foreignObject x="0" y="0" width="72" height="72">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; font-size: 50px; font-family: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;">${emoji}</div>
  </foreignObject>
</svg>`;
};

export async function POST(request: NextRequest) {
  try {
    const { emoji } = await request.json();
    console.log("Received emoji:", emoji);

    // 수신한 이모지의 코드포인트 정보 로깅
    const emojiInfo = debugEmoji(emoji);
    console.log("Received emoji details:", emojiInfo);

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    let fontBase64 = "";
    const fontFamily = "Noto Color Emoji";
    let debugInfo: DebugInfo = {
      emojiDetails: emojiInfo,
    };

    // 캐시에서 먼저 확인
    if (emojiSubsetCache[emoji]) {
      console.log("Cache hit for emoji:", emoji);
      fontBase64 = emojiSubsetCache[emoji];
      debugInfo.cacheHit = true;
    } else {
      console.log("Cache miss for emoji:", emoji);
      debugInfo.cacheHit = false;

      try {
        // 워커 스크립트 실행
        const startTime = Date.now();
        const subsetBase64 = await runWorkerScript(emoji);
        const endTime = Date.now();
        debugInfo.processingTimeMs = endTime - startTime;

        if (subsetBase64) {
          fontBase64 = subsetBase64;
          emojiSubsetCache[emoji] = fontBase64;
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
          svgContent: createSimpleSvg(emoji),
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
        svgContent: createSimpleSvg(emoji),
        fontProcessed: false,
        fontFamily: fontFamily,
        debug: debugInfo,
      });
    }

    // SVG 생성
    const svgContent = createSvgWithFont(emoji, fontBase64);

    return NextResponse.json({
      svgContent,
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
