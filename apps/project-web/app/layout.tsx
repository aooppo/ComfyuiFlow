import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../components/i18n/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComfyuiFlow Studio",
  description: "Local project and source asset workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
