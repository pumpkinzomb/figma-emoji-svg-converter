import { NextRequest, NextResponse } from "next/server";

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

// PNG를 포함한 SVG 생성 함수
const createSvgWithPng = (
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
      <use xlink:href="#${imageId}" transform="scale(${1 / width})"/>
    </pattern>
    <image id="${imageId}" width="${width}" height="${height}" xlink:href="data:image/png;base64,${pngBase64}"/>
  </defs>
</svg>`;
};

export async function POST(request: NextRequest) {
  try {
    const { emoji, pngBase64, width = 72, height = 72 } = await request.json();
    console.log("Received emoji for PNG conversion:", emoji);
    console.log(`SVG dimensions: ${width}x${height}`);

    // 수신한 이모지의 코드포인트 정보 로깅
    const emojiInfo = debugEmoji(emoji);
    console.log("Received emoji details:", emojiInfo);

    if (!emoji || !pngBase64) {
      return NextResponse.json(
        {
          error: emoji ? "PNG data is required" : "Emoji is required",
        },
        { status: 400 }
      );
    }

    const debugInfo: DebugInfo = {
      emojiDetails: emojiInfo,
      pngBase64Length: pngBase64.length,
    };

    // 클라이언트에서 생성한 PNG 데이터로 SVG 생성
    const svgContent = createSvgWithPng(pngBase64, width, height);

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
