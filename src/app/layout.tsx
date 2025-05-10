import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Figma Emoji SVG Converter | by zombcat",
  description:
    "Transform Figma emoji SVGs into properly rendered foreignObject elements for better compatibility",
  keywords: [
    "figma",
    "emoji",
    "svg",
    "converter",
    "foreignObject",
    "compatibility",
    "design",
    "zombcat",
  ],
  creator: "zombcat",
  authors: [{ name: "zombcat" }],
  openGraph: {
    title: "Figma Emoji SVG Converter",
    description:
      "Transform Figma emoji SVGs into properly rendered foreignObject elements for better compatibility",
    type: "website",
    siteName: "Figma Emoji SVG Converter",
    images: [
      {
        url: "/screenshot.png",
        width: 1200,
        height: 630,
        alt: "Figma Emoji SVG Converter Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Figma Emoji SVG Converter",
    description:
      "Transform Figma emoji SVGs into properly rendered foreignObject elements for better compatibility",
    images: ["/screenshot.png"],
    creator: "@zombcat",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
