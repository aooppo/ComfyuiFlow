import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComfyuiFlow Studio",
  description: "Local project and source asset workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a className="brand" href="/" aria-label="ComfyuiFlow project library">
            <span className="brandMark">CF</span>
            <span>ComfyuiFlow</span>
          </a>
          <span className="localBadge">Local studio</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
