"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "نسخ الرابط" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("انسخ الرابط يدويًا:", text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ تم النسخ" : label}
    </button>
  );
}
