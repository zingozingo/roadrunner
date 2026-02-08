import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getUnresolvedApprovalCount } from "@/lib/supabase";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Relay — Initiative Tracker",
  description: "AI-powered initiative tracker for AWS Partner Development",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let badgeCount = 0;
  try {
    badgeCount = await getUnresolvedApprovalCount();
  } catch {
    // Supabase may not be available during build
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen">
          <Sidebar initialBadgeCount={badgeCount} />
          <main className="flex-1 overflow-y-auto lg:ml-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
