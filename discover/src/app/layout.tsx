import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-tutoria-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Tutoria | Learn, Share, Connect",
  description:
    "Discover skills, creators, communities, and experiences that help you grow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${cormorantGaramond.variable} h-full antialiased`}
    >
      <body className="tutoria-cosmos min-h-[100dvh] flex flex-col">{children}</body>
    </html>
  );
}
