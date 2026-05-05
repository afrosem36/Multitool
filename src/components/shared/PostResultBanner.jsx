import { useEffect, useRef, useState } from "react";
import AdSenseUnit from "./AdSenseUnit";

// Renders a banner ad ONLY after the tool has produced a result.
// Props:
//   show      — boolean: set true when result is ready
//   slot      — AdSense slot ID (replace with your real slot)
//   format    — AdSense format (default "auto")
//
// A 600 ms delay gives the result section time to fully paint before
// the ad unit requests its size, preventing "No slot size" errors.

const RESULT_DELAY_MS = 600;

export default function PostResultBanner({
  show,
  slot = "YOUR_ADSENSE_SLOT_ID",
  format = "auto",
}) {
  const [ready, setReady] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (show && !ready) {
      timer.current = setTimeout(() => setReady(true), RESULT_DELAY_MS);
    }
    if (!show) {
      clearTimeout(timer.current);
      setReady(false);
    }
    return () => clearTimeout(timer.current);
  }, [show]);

  if (!ready) return null;

  return (
    <div style={{ margin: "1.5rem 0", width: "100%" }}>
      <AdSenseUnit slot={slot} format={format} responsive="true" />
    </div>
  );
}
