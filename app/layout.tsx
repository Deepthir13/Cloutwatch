import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { AppShell } from "@/components/layout/AppShell";
import { seedNotifications } from "@/lib/seedNotifications";
import { seedRedFlags } from "@/lib/seedRedFlags";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cloutwatch",
  description: "Creator Investment Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  seedNotifications();
  seedRedFlags();

  return (
    <html lang="en">
      <body className="bg-bg-base text-grey-100 antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
