import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import {
  defaultDescription,
  getAbsoluteUrl,
  getSiteUrl,
  siteName
} from "../lib/seo/metadata";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body"
});

const plusJakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-heading"
});

export const metadata: Metadata = {
  applicationName: siteName,
  description: defaultDescription,
  metadataBase: getSiteUrl(),
  openGraph: {
    description: defaultDescription,
    siteName,
    title: siteName,
    type: "website",
    url: getAbsoluteUrl("/")
  },
  title: siteName
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${inter.variable} ${plusJakartaSans.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
