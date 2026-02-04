"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function CopyLinkButton({
  baseUrl,
  className = "",
  label = "Copy Link",
}: {
  baseUrl?: string; // optional override; otherwise uses window.location.origin
  className?: string;
  label?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  const href = useMemo(() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  async function onCopy() {
    try {
      const origin =
        baseUrl?.replace(/\/$/, "") ||
        (typeof window !== "undefined" ? window.location.origin : "");

      const url = origin ? `${origin}${href}` : href;

      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback for older browsers / permissions
      try {
        const origin =
          baseUrl?.replace(/\/$/, "") ||
          (typeof window !== "undefined" ? window.location.origin : "");
        const url = origin ? `${origin}${href}` : href;

        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);

        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {}
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={
        "rounded-xl border border-neutral-800 bg-black px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white " +
         
        className
      }
      aria-label="Copy current page link"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
