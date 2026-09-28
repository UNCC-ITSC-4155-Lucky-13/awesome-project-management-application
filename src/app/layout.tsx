import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Inter } from "next/font/google";

import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BetterJira",
  description: "Organize your team's work and keep projects moving.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(geist.variable, "dark", "font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <TRPCReactProvider>
          <Toaster />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
