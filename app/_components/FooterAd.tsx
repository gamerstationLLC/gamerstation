"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export default function FooterAd() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pushedRef = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // Load only when close to viewport (helps perf)
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    if (pushedRef.current) return;

    const run = () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushedRef.current = true;
      } catch {
        // blocked/not ready – ignore
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      // @ts-ignore
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 350);
    }
  }, [shouldLoad]);

  return (
    <footer
      ref={wrapRef}
      className="
        relative
        mt-10
        border-t border-white/10
        bg-black/20
        backdrop-blur
      "
    >
      <div className="mx-auto w-full max-w-[1200px] px-3 py-6">
        

        {shouldLoad ? (
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-format="fluid"
            data-ad-layout-key="-fz+5z+41-cs+7r"
            data-ad-client="ca-pub-9530220531970117"
            data-ad-slot="8335454155"
          />
        ) : (
          // lightweight placeholder so footer keeps shape while we wait
          <div className="h-[90px] rounded-xl border border-white/10 bg-white/5" />
        )}
      </div>
    </footer>
  );
}
