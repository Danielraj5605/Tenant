import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { SerwistProvider } from "@serwist/next/react";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Tenant",
  description: "Who's home decides the chores, the meals and the split.",
  applicationName: "Tenant",
  appleWebApp: { capable: true, title: "Tenant", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#F5F4EF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-ink">
        {/* The service worker is built by `npm run build`, so it only exists in production. */}
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"}>
          <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">{children}</div>
        </SerwistProvider>
      </body>
    </html>
  );
}
