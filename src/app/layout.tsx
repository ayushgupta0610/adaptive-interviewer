import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adaptive Interviewer — AI mock interviews from any job description",
  description:
    "Paste a job description, set guidelines, and practice with a voice-first AI interviewer that adapts to your answers and scores you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <TopBar />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-slate-200/70 py-5 text-center text-xs text-slate-400">
          Adaptive Interviewer · MVP demo · adapts &amp; scores from any job description
        </footer>
      </body>
    </html>
  );
}
