import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { UnsavedChangesProvider } from "@/components/shared/UnsavedChangesProvider";
import { getInboxGroupCount } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roadrunner",
  description: "Partner intelligence platform for AWS PDMs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let badgeCount = 0;
  try {
    badgeCount = await getInboxGroupCount();
  } catch {
    // Supabase may not be available during build
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UnsavedChangesProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar initialBadgeCount={badgeCount} />
            <main className="flex-1 min-w-0 overflow-y-auto">
              {children}
            </main>
          </div>
        </UnsavedChangesProvider>
      </body>
    </html>
  );
}
