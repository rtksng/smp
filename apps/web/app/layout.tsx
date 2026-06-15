import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import type { ReactNode } from "react";
import {
  defaultDescription,
  getAbsoluteUrl,
  getSiteUrl,
  siteName
} from "../lib/seo/metadata";
import "./globals.css";
import { Providers } from "./providers";

const openSans = Open_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-open-sans"
});

const montserrat = Montserrat({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-montserrat"
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
      className={`${openSans.variable} ${montserrat.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
