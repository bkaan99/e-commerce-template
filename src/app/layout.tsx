import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteConfig } from "@/config/site.config";
import { themeToCss } from "@/config/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: {
    siteName: siteConfig.name,
    locale: "tr_TR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={siteConfig.locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeToCss() }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
