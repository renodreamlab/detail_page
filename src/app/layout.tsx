import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "phoenix detail page",
  description: "기존 상세페이지 이미지와 PDF를 분석해 구매전환 중심 상세페이지 이미지로 리디자인합니다.",
  icons: {
    icon: "/phoenix-ai-logo.png",
    shortcut: "/phoenix-ai-logo.png",
    apple: "/phoenix-ai-logo.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
