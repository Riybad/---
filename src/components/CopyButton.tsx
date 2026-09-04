"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "نسخ الرابط" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost text-sm"
      onClick={async () => {
        // المسارات النسبية تُحوَّل لرابط كامل حتى يعمل عند إرساله في واتساب
        const url = text.startsWith("/") ? `${window.location.origin}${text}` : text;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("انسخ الرابط يدويًا:", url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ تم النسخ" : label}
    </button>
  );
}
