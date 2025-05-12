import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

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
  processingTimeMs?: number;
  pngBase64Length?: number;
  pngError?: string;
  hasPng?: boolean;
  [key: string]: any;
}

// 이모지 디버깅 헬퍼 함수
const debugEmoji = (emoji: string): EmojiDebugInfo => {
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

// Puppeteer를 사용하여 이모지를 PNG로 변환하는 함수
async function createEmojiPng(emoji: string): Promise<string> {
  let browser;
  try {
    // Puppeteer 브라우저 시작
    browser = await puppeteer.launch();

    const page = await browser.newPage();

    // 이모지를 HTML 페이지에 삽입
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              width: 160px;
              height: 160px;
              background: transparent;
            }
            .emoji {
              font-size: 120px;
              line-height: 1;
            }
          </style>
        </head>
        <body>
          <div class="emoji">${emoji}</div>
        </body>
      </html>
    `);

    // 페이지 크기 설정
    await page.setViewport({
      width: 160,
      height: 160,
      deviceScaleFactor: 2, // 더 선명한 이미지를 위해
    });

    // 스크린샷 촬영
    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true, // 배경 투명하게
    });

    // Base64로 변환 - Buffer로 안전하게 타입 변환 후 Base64 인코딩
    const buffer = Buffer.from(screenshot);
    const base64Data = buffer.toString("base64");

    return base64Data;
  } catch (error) {
    console.error("Error creating emoji PNG with Puppeteer:", error);
    throw error;
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
    }
  }
}

// PNG를 포함한 SVG 생성 함수
const createSvgWithPng = (
  emoji: string,
  pngBase64: string,
  width: number,
  height: number
): string => {
  // 고유한 ID 생성을 위한 타임스탬프
  const timestamp = Date.now();
  const patternId = `pattern_${timestamp}`;
  const imageId = `image_emoji_${timestamp}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M1 ${height - 1}H${width - 1}V1H1V${
    height - 1
  }Z" fill="url(#${patternId})"/>
  <defs>
    <pattern id="${patternId}" patternContentUnits="objectBoundingBox" width="1" height="1">
      <use xlink:href="#${imageId}" transform="scale(${1 / 160})"/>
    </pattern>
    <image id="${imageId}" width="160" height="160" xlink:href="data:image/png;base64,${pngBase64}"/>
  </defs>
</svg>`;
};

export async function POST(request: NextRequest) {
  try {
    const { emoji, width = 72, height = 72 } = await request.json();
    console.log("Received emoji for PNG conversion:", emoji);
    console.log(`SVG dimensions: ${width}x${height}`);

    // 수신한 이모지의 코드포인트 정보 로깅
    const emojiInfo = debugEmoji(emoji);
    console.log("Received emoji details:", emojiInfo);

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    let pngBase64 = "";
    const debugInfo: DebugInfo = {
      emojiDetails: emojiInfo,
    };

    try {
      // PNG 이미지 생성
      const startTime = Date.now();
      const pngData = await createEmojiPng(emoji);
      const endTime = Date.now();

      if (pngData) {
        pngBase64 = pngData;
        debugInfo.processingTimeMs = endTime - startTime;
        debugInfo.pngBase64Length = pngBase64.length;
      } else {
        throw new Error("PNG creation returned null");
      }
    } catch (error) {
      console.error("Error in PNG creation:", error);
      debugInfo.pngError =
        error instanceof Error ? error.message : String(error);

      // PNG 처리 실패 시 오류 반환
      return NextResponse.json(
        {
          error: "Failed to create PNG image",
          debug: debugInfo,
        },
        { status: 500 }
      );
    }

    // SVG 생성
    const svgContent = createSvgWithPng(emoji, pngBase64, width, height);

    return NextResponse.json({
      svgContent,
      pngProcessed: true,
      debug: debugInfo,
    });
  } catch (error) {
    console.error("Error processing emoji for PNG:", error);
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
