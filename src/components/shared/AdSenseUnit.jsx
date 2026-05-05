import { useEffect, useRef } from "react";

// Minimum pre-reserved heights per format — prevents layout shift (CLS).
const SLOT_HEIGHTS = {
  auto:      90,
  rectangle: 250,
  banner:    90,
  leaderboard: 90,
};

export default function AdSenseUnit({
  slot,
  format = "auto",
  responsive = "true",
  style = {},
}) {
  const wrapRef = useRef(null);
  const insRef  = useRef(null);
  const pushed  = useRef(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const ins  = insRef.current;
    if (!wrap || !ins || pushed.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        // Guard: container must actually have width (avoids "No slot size" error)
        if (wrap.offsetWidth === 0) return;

        pushed.current = true;
        observer.disconnect();
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (_) {}
      },
      { threshold: 0.1 }
    );

    observer.observe(wrap);
    return () => observer.disconnect();
  }, [slot]);

  const minHeight = SLOT_HEIGHTS[format] ?? 90;

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        minHeight,
        overflow: "hidden",
        contain: "layout",  // isolates layout so CLS doesn't propagate
      }}
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", minHeight, ...style }}
        data-ad-client="ca-pub-7503234817085638"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
}
