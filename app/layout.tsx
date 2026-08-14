import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });
export const metadata: Metadata = { title: { default: "Kinfolio", template: "%s · Kinfolio" }, description: "A secure family stock portfolio tracker." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body className={`${manrope.variable} ${newsreader.variable} min-h-full antialiased`}><AppProvider>{children}</AppProvider></body></html>; }

