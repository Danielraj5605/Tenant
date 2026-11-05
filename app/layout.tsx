import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Tenant",
  description: "Who's home decides the chores, the meals and the split.",
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
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">{children}</div>
      </body>
    </html>
  );
}
