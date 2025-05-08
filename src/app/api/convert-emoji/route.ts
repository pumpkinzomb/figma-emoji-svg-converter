import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { emoji } = await request.json();

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    // Generate SVG with the emoji in a foreignObject for better vector support
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">
  <foreignObject x="0" y="0" width="72" height="72">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; font-size: 50px;">${emoji}</div>
  </foreignObject>
</svg>`;

    return NextResponse.json({ svgContent });
  } catch (error) {
    console.error("Error processing emoji:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process emoji",
      },
      { status: 500 }
    );
  }
}
