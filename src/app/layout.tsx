import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Footer } from "@/components/layout/footer";
import { FontSizeInit } from "@/components/layout/font-size-init";
import { PostHogProvider } from "@/components/posthog-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display serif. Variable font — gives us weight + optical
// sizing + the "SOFT" axis we lean on in globals.css for a slightly
// warmer, less rigid feel than plain Fraunces. Used on headlines and
// numeric display (streak counts, progress numbers).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0f0d0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  // Intentionally no `manifest` or `icons` overrides: Next.js 16
  // auto-discovers src/app/manifest.ts + src/app/icon.tsx +
  // src/app/apple-icon.tsx and wires them up. Palette stays in sync
  // with globals.css because all three are generated at build time.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PostHogProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <FontSizeInit />
            <Navbar />
            <main className="flex-1 pb-20 md:pb-0">
              <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
            </main>
            <Footer />
            <MobileNav />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
