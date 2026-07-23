import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";
import { PersonProvider } from "@/contexts/PersonContext";
import { ServiceWorkerRegistrar } from "@/components/push/ServiceWorkerRegistrar";
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

const siteUrl = "https://nicka-fam.vercel.app";
const title = "nicka fam";
const description =
  "the group that actually settles up. mostly bills, some chaos, occasional beach day.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  // This is what actually matters for iOS "Add to Home Screen" behavior
  // (a full manifest.json is more of an Android/Chrome install-prompt
  // thing and isn't set up here) -- Safari has supported this Apple-only
  // meta tag long before the standard web manifest existed.
  appleWebApp: {
    capable: true,
    title,
  },
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
        <PersonProvider>
          <ServiceWorkerRegistrar />
          {children}
        </PersonProvider>
      </body>
    </html>
  );
}
