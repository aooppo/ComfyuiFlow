"use client";

import type { ReactNode } from "react";
import { LanguageProvider, useLanguage } from "./language-provider";

function Shell({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useLanguage();
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="ComfyuiFlow project library">
          <span className="brandMark">CF</span>
          <span>ComfyuiFlow</span>
        </a>
        <div className="topbarActions" data-i18n-ignore>
          <span className="localBadge">{locale === "zh-CN" ? "本地工作室" : "Local studio"}</span>
          <div className="languageSwitch" role="group" aria-label="Language / 语言">
            <button
              type="button"
              aria-pressed={locale === "zh-CN"}
              onClick={() => setLocale("zh-CN")}
            >
              中文
            </button>
            <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
              EN
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <Shell>{children}</Shell>
    </LanguageProvider>
  );
}
