import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

// Inter is the closest widely-available match to Notion's interface type.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Opportunity Command Center",
  description: "Find opportunities. Take the shot. Follow up. Repeat.",
};

export const viewport: Viewport = {
  themeColor: "#191919",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` covers this element's own attributes only —
     * real mismatches anywhere inside the app still report normally.
     *
     * Browser extensions routinely stamp attributes onto <html> before React
     * loads (wallets, password managers, theme switchers), and React then flags
     * the difference as a hydration error the app cannot fix or reproduce for
     * anyone else. Left unsuppressed it fires on every page load and buries the
     * mismatches that would actually be ours.
     */
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
