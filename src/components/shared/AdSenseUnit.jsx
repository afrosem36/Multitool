import { useEffect } from "react";
import "./AdSenseUnit.css";

export default function AdSenseUnit({
  slot,
  format = "auto",
  responsive = "true",
  style = { display: "block", minHeight: 100 },
}) {
  useEffect(() => {
    try {
      // push only after script is loaded
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("AdSense push failed", e);
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client="ca-pub-7503234817085638"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive}
    />
  );
}