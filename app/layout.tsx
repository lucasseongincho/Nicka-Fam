import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";
import { PersonProvider } from "@/contexts/PersonContext";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "nicka fam",
  description: "the group that actually settles up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fredoka.variable} ${inter.variable} font-body antialiased`}
      >
        <PersonProvider>{children}</PersonProvider>
      </body>
    </html>
  );
}
