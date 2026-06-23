import type { Metadata, Viewport } from "next";
import { Lato, Inter } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegisterSW } from "@/components/pwa/register-sw";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RISE — Personal OS",
  description: "Your AI-powered personal operating system",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RISE",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#138A57",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${lato.variable} ${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="h-full bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <RegisterSW />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
