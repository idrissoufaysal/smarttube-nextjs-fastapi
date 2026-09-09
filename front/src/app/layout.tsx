import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner"


const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartTube | Transform Any Video Into A Structured Lesson",
  description:
    "Stop passive scrolling. Start active mastery. Paste a link to generate transcripts, AI-powered notes, and personalized quizzes instantly.",
  keywords: [
    "AI study",
    "video learning",
    "quiz generator",
    "smart notes",
    "YouTube study tool",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", inter.variable, "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <Header />
          {children}
          <Toaster richColors position="top-center" />
        </ClerkProvider>
      </body>
    </html>
  );
}
