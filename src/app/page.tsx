"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import {
  UploadIcon,
  DownloadIcon,
  Figma,
  Sparkles,
  Smile,
  HeartHandshake,
  Download,
} from "lucide-react";

interface SvgItem {
  id: string;
  content: string;
  convertedContent?: string;
}

export default function Home() {
  const [svgItems, setSvgItems] = useState<SvgItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const promises = acceptedFiles.map((file) => {
        if (file.type === "image/svg+xml") {
          return new Promise<SvgItem>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const content = e.target?.result as string;
              resolve({
                id: `svg-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
                content,
              });
            };
            reader.onerror = reject;
            reader.readAsText(file);
          });
        } else {
          toast({
            title: "Error",
            description: `File ${file.name} is not a valid SVG file`,
            variant: "destructive",
          });
          return Promise.resolve(null);
        }
      });

      Promise.all(promises).then((results) => {
        const validResults = results.filter(Boolean) as SvgItem[];
        if (validResults.length > 0) {
          setSvgItems((prev) => [...prev, ...validResults]);
        }
      });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/svg+xml": [".svg"],
    },
    multiple: true,
  });

  const convertToVectorSvg = async () => {
    if (svgItems.length === 0) return;

    setIsConverting(true);
    try {
      const convertedItems = await Promise.all(
        svgItems.map(async (item) => {
          if (item.convertedContent) return item; // Skip if already converted

          try {
            // Parse the SVG content
            const itemParser = new DOMParser();
            const itemSvgDoc = itemParser.parseFromString(
              item.content,
              "image/svg+xml"
            );
            const itemSvgElement = itemSvgDoc.documentElement;

            // 입력된 SVG가 올바른지 확인
            const itemParseError = itemSvgDoc.querySelector("parsererror");
            if (itemParseError) {
              throw new Error(
                "Invalid SVG format. Please upload a valid SVG file."
              );
            }

            // Get the text content - 텍스트 요소 또는 tspan 요소 확인
            const itemTextElement = itemSvgElement.querySelector("text, tspan");
            if (!itemTextElement) {
              throw new Error(
                "No text element found in SVG. This SVG might not contain an emoji."
              );
            }

            const itemTextContent = itemTextElement.textContent?.trim() || "";
            if (!itemTextContent) {
              throw new Error(
                "Text content is empty. Please ensure the SVG contains emoji text."
              );
            }

            // Call API to convert emoji to SVG with foreignObject
            const itemResponse = await fetch("/api/convert-emoji", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ emoji: itemTextContent }),
            });

            if (!itemResponse.ok) {
              const errorData = await itemResponse.json();
              throw new Error(errorData.error || "Failed to convert emoji");
            }

            const data = await itemResponse.json();

            // Validate returned SVG content
            if (!data.svgContent || !data.svgContent.includes("<svg")) {
              throw new Error("Invalid SVG data returned from server");
            }

            return {
              ...item,
              convertedContent: data.svgContent,
            };
          } catch (error) {
            console.error(`Error converting SVG ${item.id}:`, error);
            toast({
              title: "Error",
              description:
                error instanceof Error
                  ? error.message
                  : "Failed to convert emoji",
              variant: "destructive",
            });
            return item;
          }
        })
      );

      setSvgItems(convertedItems);

      toast({
        title: "Success",
        description: "Emoji has been converted to SVG",
      });
    } catch (error) {
      console.error("Conversion error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to convert emoji",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const downloadSvg = (svgContent: string, index: number) => {
    const link = document.createElement("a");
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    link.href = URL.createObjectURL(blob);
    link.download = `emoji-${index + 1}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const downloadAllSvgs = () => {
    // 변환된 SVG들만 필터링
    const convertedItems = svgItems.filter((item) => item.convertedContent);

    if (convertedItems.length === 0) {
      toast({
        title: "Nothing to download",
        description: "Please convert SVGs first",
        variant: "destructive",
      });
      return;
    }

    // 단일 SVG인 경우 바로 다운로드
    if (convertedItems.length === 1) {
      downloadSvg(convertedItems[0].convertedContent!, 0);
      return;
    }

    try {
      // 여러 SVG인 경우 ZIP 파일로 다운로드
      import("jszip")
        .then(({ default: JSZip }) => {
          const zip = new JSZip();

          convertedItems.forEach((item, index) => {
            if (item.convertedContent) {
              zip.file(`emoji-${index + 1}.svg`, item.convertedContent);
            }
          });

          return zip.generateAsync({ type: "blob" });
        })
        .then((content: Blob) => {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(content);
          link.download = "figma-emojis.zip";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

          toast({
            title: "Success",
            description: `${convertedItems.length} SVGs have been downloaded as a ZIP file`,
          });
        })
        .catch((error) => {
          console.error("Error creating ZIP file:", error);
          toast({
            title: "Error",
            description: "Failed to create ZIP file for download",
            variant: "destructive",
          });
        });
    } catch (error) {
      console.error("Error during ZIP creation:", error);
      toast({
        title: "Error",
        description: "Failed to create ZIP file for download",
        variant: "destructive",
      });
    }
  };

  // Calculate item size based on number of items
  const getItemSize = (itemCount: number) => {
    if (itemCount <= 1) return "h-32 w-32";
    if (itemCount <= 4) return "h-24 w-24";
    if (itemCount <= 9) return "h-16 w-16";
    return "h-12 w-12";
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-950 dark:via-pink-950 dark:to-blue-950 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Figma className="w-10 h-10 text-[#F24E1E]" />
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <Smile className="w-8 h-8 text-pink-500" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r leading-tight from-purple-600 via-pink-500 to-blue-500 text-transparent bg-clip-text">
            Figma Emoji SVG Converter
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-3 text-lg max-w-lg mx-auto">
            Transform Figma emoji SVGs into properly rendered foreignObject
            elements for better compatibility
          </p>
          <div className="mt-4 flex justify-center text-2xl space-x-2">
            <span>😊</span>
            <span>👍</span>
            <span>🎨</span>
            <span>✨</span>
            <span>💖</span>
          </div>
        </div>

        <Card className="shadow-xl border-0 overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                <UploadIcon className="w-5 h-5 text-white" />
              </div>
              <span>Upload Figma Emoji SVGs</span>
            </CardTitle>
            <CardDescription className="text-base">
              Drag and drop your Figma emoji SVG files here or click to browse
              <span className="block mt-1 text-sm opacity-70">
                (Multiple files supported)
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 transition-all duration-300 ease-in-out cursor-pointer relative 
                ${
                  isDragActive
                    ? "border-pink-400 bg-pink-50 dark:bg-pink-950/30 scale-[1.01] shadow-lg"
                    : "border-gray-200 dark:border-gray-700 hover:border-pink-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
                }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="absolute -top-1 -right-1 bg-pink-100 dark:bg-pink-900 text-pink-500 text-xs rounded-full px-2 py-1 font-medium animate-pulse">
                    SVG
                  </div>
                  <UploadIcon
                    className={`w-16 h-16 ${
                      isDragActive ? "text-pink-500" : "text-purple-300"
                    } transition-colors duration-300`}
                  />
                </div>
                <p className="text-center max-w-md">
                  <span
                    className={`font-medium ${
                      isDragActive
                        ? "text-pink-600 dark:text-pink-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {isDragActive
                      ? "Drop your emoji SVGs here"
                      : "Drag & drop Figma emoji SVGs here"}
                  </span>
                  <span className="block mt-1 text-gray-500 dark:text-gray-400 text-sm">
                    or click to select files from your computer
                  </span>
                </p>
              </div>
            </div>

            {svgItems.length > 0 && (
              <>
                <Separator className="my-6 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Original SVGs */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Figma className="w-4 h-4 text-[#F24E1E]" />
                        <h3 className="font-medium text-purple-800 dark:text-purple-300">
                          Figma Emoji SVGs
                        </h3>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 rounded-xl border border-purple-100 dark:border-purple-900 p-6 shadow-inner">
                        <div className="flex flex-wrap justify-center gap-4">
                          {svgItems.map((item, index) => (
                            <div
                              key={item.id}
                              className={`${getItemSize(
                                svgItems.length
                              )} flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-purple-100 dark:border-purple-800`}
                            >
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: item.content,
                                }}
                                className="w-full h-full flex items-center justify-center transform scale-75"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Converted SVGs */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        <h3 className="font-medium text-pink-600 dark:text-pink-300">
                          Converted ForeignObject SVGs
                        </h3>
                      </div>
                      <div className="bg-gradient-to-br from-pink-50 to-blue-50 dark:from-pink-950/40 dark:to-blue-950/40 rounded-xl border border-pink-100 dark:border-pink-900 p-6 shadow-inner relative">
                        <div className="flex flex-wrap justify-center gap-4">
                          {svgItems.map((item, index) => (
                            <div
                              key={item.id}
                              className={`${getItemSize(
                                svgItems.length
                              )} flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-pink-100 dark:border-pink-800 relative group`}
                            >
                              {item.convertedContent ? (
                                <>
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: item.convertedContent,
                                    }}
                                    className="w-full h-full flex items-center justify-center transform scale-75"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      downloadSvg(item.convertedContent!, index)
                                    }
                                    className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-pink-500 text-white opacity-0 hover:text-white group-hover:opacity-100 transition-opacity shadow-sm hover:bg-pink-600 mr-2 mb-2"
                                    title="Download SVG"
                                  >
                                    <DownloadIcon className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <div className="text-xs text-gray-400 dark:text-gray-500 text-center p-1">
                                  {isConverting ? (
                                    <span className="inline-flex items-center">
                                      <svg
                                        className="animate-spin -ml-1 mr-2 h-3 w-3 text-pink-500"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                        ></circle>
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                      </svg>
                                      Converting
                                    </span>
                                  ) : (
                                    "Ready for conversion"
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 모든 SVG 다운로드 버튼 */}
                        {svgItems.some((item) => item.convertedContent) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={downloadAllSvgs}
                            className="absolute bottom-2 right-2 bg-pink-500 hover:bg-pink-600 text-white shadow-md"
                            title="Download All SVGs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            <span>Download All</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={convertToVectorSvg}
                    disabled={isConverting}
                    className="w-full h-14 text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-md hover:shadow-lg transition-all"
                  >
                    {isConverting ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Converting...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Convert to ForeignObject SVG
                      </span>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-center gap-1 mb-2">
            <HeartHandshake className="h-4 w-4 text-pink-500" />
            <span>Made with love for Figma users</span>
          </div>
          <div className="flex items-center justify-center mt-2 mb-1">
            <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full p-1">
              <Smile className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="opacity-70">
            Convert emoji SVGs from Figma into properly rendered foreignObject
            elements
          </p>
          <p className="text-xs mt-4">
            &copy; {new Date().getFullYear()} zombcat. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
