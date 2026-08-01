import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-admin"
});

export const metadata: Metadata = {
  title: "Surgical Platform Admin",
  description: "Admin dashboard for surgical medical equipment operations."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={plusJakartaSans.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
