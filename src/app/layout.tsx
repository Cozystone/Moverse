import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moverse — 화면 밖에서 만나고, 함께 움직이다",
  description: "학생들이 현실의 활동을 발견하고 함께 움직이며 새로운 장소와 이벤트를 만드는 위치 기반 대면 활동 SNS",
  applicationName: "Moverse",
  keywords: ["Moverse", "청소년", "운동", "스포츠", "활동", "위치 기반"],
  authors: [{ name: "Moverse Team" }],
  openGraph: {
    title: "Moverse — Move the real world",
    description: "걷고, 만나고, 함께 움직이며 현실의 Moverse를 성장시키세요.",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0c1917",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
