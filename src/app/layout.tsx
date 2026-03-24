import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import MilesChatBubble from "@/components/MilesChatBubble";
import "./globals.css";

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const fontBody = Be_Vietnam_Pro({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Proxe — Borrow from your neighbors. Share what you own.",
  description:
    "A hyper-local AI-powered sharing platform for apartment buildings. Borrow a drill, lend a mixer, build trust with your neighbors.",
  openGraph: {
    title: "Proxe — Sustainable Community Living",
    description: "Borrow from your neighbors. Share what you own.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body min-h-screen bg-[#fdf9f5] text-[#1c1b1a]">
        {children}
        <MilesChatBubble />
      </body>
    </html>
  );
}
