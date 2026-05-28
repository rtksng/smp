import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  defaultDescription,
  getAbsoluteUrl,
  getSiteUrl,
  siteName
} from "../lib/seo/metadata";
import "./globals.css";
import { Providers } from "./providers";

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
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
