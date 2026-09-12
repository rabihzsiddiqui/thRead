import type { Metadata, Viewport } from "next";
import { Petrona, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/thread/service-worker";

/* mono is the logging register: capture, timeline, and all chrome */
const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-sans-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

/* serif is the written register: only the woven day */
const petrona = Petrona({
  variable: "--font-petrona",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "thRead",
  description:
    "a voice-first journal. say one thing at a time, read the day back as one piece.",
  applicationName: "thRead",
  appleWebApp: {
    capable: true,
    title: "thRead",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // required for env(safe-area-inset-*) to report anything
  viewportFit: "cover",
  themeColor: "#e8e9e4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${splineSansMono.variable} ${petrona.variable}`}>
      <body>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
