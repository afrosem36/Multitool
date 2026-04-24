import { useRef, useMemo, useCallback } from "react";

/**
 * TiltCard – 3-D tilt + spotlight on hover.
 *
 * Props:
 *   tiltLimit  {number}  Max tilt angle in degrees          (default 15)
 *   scale      {number}  Scale factor on hover              (default 1.05)
 *   perspective{number}  CSS perspective distance in px     (default 1200)
 *   effect     {string}  "gravitate" | "evade"              (default "evade")
 *   spotlight  {boolean} Show cursor-following spotlight    (default true)
 *   className  {string}  Extra class names
 *   style      {object}  Extra inline styles
 *   children   {node}
 */
export function TiltCard({
  tiltLimit = 15,
  scale = 1.05,
  perspective = 1200,
  effect = "evade",
  spotlight = true,
  className = "",
  style,
  children,
}) {
  const cardRef = useRef(null);
  const spotRef = useRef(null);
  const spotWrapRef = useRef(null);

  // Compute direction multiplier only when `effect` changes
  const dir = useMemo(() => (effect === "evade" ? -1 : 1), [effect]);

  const resetTransform = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.transform =
      `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)`;
  }, [perspective]);

  const handlePointerMove = useCallback(
    (e) => {
      const el = cardRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const xRot = (py - 0.5) * (tiltLimit * 2) * dir;
      const yRot = (px - 0.5) * -(tiltLimit * 2) * dir;

      // Mutate DOM directly – zero React re-renders
      el.style.transform =
        `perspective(${perspective}px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale3d(${scale},${scale},${scale})`;

      if (spotlight && spotRef.current) {
        spotRef.current.style.left = `${px * 100}%`;
        spotRef.current.style.top  = `${py * 100}%`;
      }
    },
    [tiltLimit, scale, perspective, dir, spotlight]
  );

  const handlePointerEnter = useCallback(() => {
    if (spotWrapRef.current) spotWrapRef.current.style.opacity = "1";
  }, []);

  const handlePointerLeave = useCallback(() => {
    resetTransform();
    if (spotWrapRef.current) spotWrapRef.current.style.opacity = "0";
  }, [resetTransform]);

  return (
    <div
      ref={cardRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={className}
      style={{
        transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)`,
        transition: "transform 0.2s ease-out",
        transformStyle: "preserve-3d",
        willChange: "transform",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}

      {spotlight && (
        <div
          ref={spotWrapRef}
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            zIndex: 10,
            overflow: "hidden",
            opacity: 0,
            transition: "opacity 0.3s",
          }}
        >
          <div
            ref={spotRef}
            style={{
              position: "absolute",
              width: "200%",
              height: "200%",
              borderRadius: "50%",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 40%)",
            }}
          />
        </div>
      )}
    </div>
  );
}
