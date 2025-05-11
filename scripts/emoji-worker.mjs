import fs from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { Font } from "fonteditor-core";
import * as wawoff2 from "wawoff2";

// 이모지 디버깅 헬퍼 함수
const debugEmoji = (emoji) => {
  const codePoints = [...emoji].map((char) => {
    const hex = char.codePointAt(0).toString(16).toUpperCase();
    return `U+${hex}`;
  });

  return {
    emoji,
    length: emoji.length,
    codePoints,
    codePointsStr: codePoints.join(" "),
  };
};

// 로그 파일 경로 생성
const debugLogPath = path.join(
  path.dirname(process.argv[3]),
  `emoji-worker-debug-${Date.now()}.json`
);

// 디버그 정보 저장 함수
const saveDebugInfo = (info) => {
  try {
    let debugData = {};
    if (fs.existsSync(debugLogPath)) {
      const fileContent = fs.readFileSync(debugLogPath, "utf8");
      debugData = JSON.parse(fileContent);
    }

    const updatedData = {
      ...debugData,
      ...info,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(debugLogPath, JSON.stringify(updatedData, null, 2));
    console.log(`Debug info saved to ${debugLogPath}`);
  } catch (error) {
    console.error("Error saving debug info:", error);
  }
};

// 인자 파싱
const fontPath = process.argv[2];
const outputPath = process.argv[3];
const emojiBase64 = process.argv[4];

if (!fontPath || !outputPath || !emojiBase64) {
  console.error(
    "Usage: node emoji-worker.mjs <font-path> <output-path> <emoji-base64>"
  );
  process.exit(1);
}

// Base64로 인코딩된 이모지 디코딩
const emoji = Buffer.from(emojiBase64, "base64").toString();
const emojiInfo = debugEmoji(emoji);

console.log(`Processing emoji: ${emoji}`);
console.log(`Emoji code points: ${emojiInfo.codePointsStr}`);
console.log(`Emoji length: ${emojiInfo.length}`);

// 초기 디버그 정보 저장
saveDebugInfo({
  stage: "start",
  args: {
    fontPath,
    outputPath,
    emojiBase64Length: emojiBase64.length,
  },
  emoji: emojiInfo,
});

// Fontkit을 사용하여 코드포인트에서 글리프 ID 찾기
function getGlyphIdsForEmoji(font, emoji) {
  const glyphIds = [];
  const codePoints = [];

  // 이모지에서 코드포인트 추출
  for (let i = 0; i < emoji.length; i++) {
    const cp = emoji.codePointAt(i);
    codePoints.push(cp);
    // 서로게이트 페어인 경우 다음 코드 유닛 건너뛰기
    if (cp > 0xffff) {
      i++;
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
        `Warning: Error processing combined emoji sequence: ${e.message}`
      );
    }
  }

  return {
    glyphIds,
    codePoints,
  };
}

// 메인 처리 함수
async function processEmoji() {
  try {
    // 폰트 파일 존재 확인
    if (!fs.existsSync(fontPath)) {
      console.error(`Font file not found: ${fontPath}`);
      saveDebugInfo({
        stage: "error",
        error: `Font file not found: ${fontPath}`,
      });
      process.exit(1);
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
    const fontObject = Font.create(fontData, {
      type: "ttf",
      hinting: true,
      compound2simple: false, // 복합 글리프 유지
      inflate: true, // WOFF 압축 해제
      combinePath: false, // 경로 최적화 안 함
    });

    // 서브셋 옵션 설정
    const subsetOpts = {
      subset: glyphIds, // 유지할 글리프 ID 목록
      dump: true, // 필요하지 않은 테이블 정리
      transform: false, // 변환 없음
    };

    // 서브셋 생성
    fontObject.optimize(subsetOpts);
    console.log("Font subset created");

    // TTF 버퍼로 변환
    const ttfBuffer = fontObject.write({
      type: "ttf",
      hinting: true,
    });
    console.log(`TTF buffer size: ${ttfBuffer.byteLength} bytes`);

    // TTF 파일 저장 (디버깅 용)
    const ttfPath = outputPath.replace(/\.[^.]+$/, ".ttf");
    fs.writeFileSync(ttfPath, Buffer.from(ttfBuffer));
    console.log(`TTF file saved to: ${ttfPath}`);

    // WOFF2로 변환
    const woff2Buffer = await wawoff2.compress(Buffer.from(ttfBuffer));
    console.log(`WOFF2 buffer size: ${woff2Buffer.length} bytes`);

    // WOFF2 파일 저장
    fs.writeFileSync(outputPath, woff2Buffer);
    console.log(`WOFF2 file saved to: ${outputPath}`);

    // 결과 검증
    const stats = fs.statSync(outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const fileSignature =
      fileBuffer.length >= 4 ? fileBuffer.slice(0, 4).toString("hex") : "N/A";
    const isValidWOFF2 = fileSignature === "774f4632";

    console.log(`File signature: ${fileSignature}`);
    console.log(`Is valid WOFF2 file: ${isValidWOFF2}`);

    // Base64 인코딩
    const base64Data = fileBuffer.toString("base64");
    console.log(`Base64 data length: ${base64Data.length} characters`);

    // 테스트 HTML 생성
    const testHtmlPath = path.join(
      path.dirname(outputPath),
      `test-emoji-${Date.now()}.html`
    );
    const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Emoji Font Test</title>
        <style>
          @font-face {
            font-family: 'EmojiSubset';
            src: url(data:font/woff2;base64,${base64Data}) format('woff2');
            font-display: block;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
          }
          .emoji-test {
            font-family: 'EmojiSubset', sans-serif;
            font-size: 72px;
            padding: 20px;
            border: 1px solid #ccc;
            min-height: 100px;
          }
          .emoji-compare {
            font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
            font-size: 72px;
            padding: 20px;
            border: 1px solid #ccc;
          }
        </style>
      </head>
      <body>
        <h1>벡터 보존 이모지 서브셋 테스트</h1>
        <div>이모지: ${emoji}</div>
        <div>코드포인트: ${emojiInfo.codePointsStr}</div>
        <div>글리프 수: ${glyphIds.length}</div>
        <div>파일 크기: ${stats.size} 바이트</div>
        
        <h2>서브셋 폰트로 렌더링:</h2>
        <div class="emoji-test">${emoji}</div>
        
        <h2>시스템 폰트로 렌더링 (비교용):</h2>
        <div class="emoji-compare">${emoji}</div>
      </body>
    </html>`;

    fs.writeFileSync(testHtmlPath, testHtml);
    console.log(`Test HTML created at: ${testHtmlPath}`);

    // 최종 결과 저장
    saveDebugInfo({
      stage: "completion",
      output: {
        path: outputPath,
        ttfPath: ttfPath,
        size: stats.size,
        signature: fileSignature,
        isValidWOFF2: isValidWOFF2,
        base64Length: base64Data.length,
        glyphIds: glyphIds,
        codePoints: codePoints.map(
          (cp) => "U+" + cp.toString(16).toUpperCase()
        ),
      },
      testHtmlPath,
      success: true,
    });

    process.exit(0);
  } catch (error) {
    console.error("Error processing emoji:", error);
    saveDebugInfo({
      stage: "error",
      error: error.toString(),
      stack: error.stack,
      success: false,
    });
    process.exit(1);
  }
}

// 실행
processEmoji();
