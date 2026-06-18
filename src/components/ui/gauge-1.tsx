"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties, SVGProps } from "react";
import { useMotionValue, useSpring } from "framer-motion";

import { cn } from "@/lib/utils";

type GaugeColor = "danger" | "warning" | "success" | "info" | string | { [key: number]: string };

export interface GaugeProps extends Omit<SVGProps<SVGSVGElement>, "className"> {
  value: number;
  size?: number | string;
  gapPercent?: number;
  strokeWidth?: number;
  equal?: boolean;
  showValue?: boolean;
  showPercentage?: boolean;
  primary?: GaugeColor;
  secondary?: GaugeColor;
  gradient?: boolean;
  multiRing?: {
    enabled: boolean;
    rings?: Array<{
      value: number;
      color: string;
      strokeWidth?: number;
      opacity?: number;
    }>;
  };
  thresholds?: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
  gaugeType?: "full" | "half" | "quarter";
  transition?: {
    length?: number;
    step?: number;
    delay?: number;
  };
  className?:
    | string
    | {
        svgClassName?: string;
        primaryClassName?: string;
        secondaryClassName?: string;
        textClassName?: string;
        labelClassName?: string;
      };
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  tickMarks?: boolean;
  glowEffect?: boolean;
}

const COLOR_PRESETS = {
  primary: {
    danger: "#ef4444",
    warning: "#f59e0b",
    info: "#38bdf8",
    success: "#22c55e",
  },
  secondary: {
    danger: "rgba(239, 68, 68, 0.22)",
    warning: "rgba(245, 158, 11, 0.22)",
    info: "rgba(56, 189, 248, 0.2)",
    success: "rgba(34, 197, 94, 0.2)",
  },
};

const GAUGE_CONFIG = {
  full: {
    startAngle: -90,
    endAngle: 270,
    sweep: 1,
    viewBox: "0 0 100 100",
  },
  half: {
    startAngle: 180,
    endAngle: 360,
    sweep: 0.5,
    viewBox: "0 0 100 58",
  },
  quarter: {
    startAngle: 270,
    endAngle: 360,
    sweep: 0.25,
    viewBox: "42 42 58 58",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveColor(color: GaugeColor | undefined, percent: number, isSecondary = false) {
  const palette = isSecondary ? COLOR_PRESETS.secondary : COLOR_PRESETS.primary;

  if (!color) {
    if (isSecondary) return "rgba(255, 255, 255, 0.12)";
    if (percent <= 30) return palette.danger;
    if (percent <= 55) return palette.warning;
    if (percent <= 78) return palette.info;
    return palette.success;
  }

  if (typeof color === "string") {
    return palette[color as keyof typeof palette] || color;
  }

  const keys = Object.keys(color)
    .map(Number)
    .sort((a, b) => a - b);

  let selected = color[keys[0]];
  for (const key of keys) {
    if (percent >= key) selected = color[key];
  }

  return palette[selected as keyof typeof palette] || selected;
}

function polarToPoint(angle: number, radius: number, center = 50) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

export function Gauge({
  value,
  size = 150,
  gapPercent = 0,
  strokeWidth = 10,
  equal = false,
  showValue = true,
  showPercentage = false,
  primary,
  secondary,
  gradient = false,
  multiRing,
  thresholds,
  gaugeType = "full",
  transition = {
    length: 1000,
    step: 200,
    delay: 0,
  },
  className,
  label,
  unit = "%",
  min = 0,
  max = 100,
  tickMarks = false,
  glowEffect = false,
  ...props
}: GaugeProps) {
  const gradientId = `gauge-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const circleSize = 100;
  const radius = circleSize / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const range = max - min || 100;
  const config = GAUGE_CONFIG[gaugeType];

  const { formattedValue: animatedValue, rawValue: animatedRawValue } = useNumberCounter({
    value: clamp(value, min, max),
    delay: (transition.delay ?? 0) / 1000,
    decimalPlaces: Math.abs(value) % 1 !== 0 ? 1 : 0,
  });

  const progressPercent = clamp(((animatedRawValue - min) / range) * 100, 0, 100);
  const trackLength = circumference * config.sweep;
  const effectiveGap = equal ? gapPercent : 0;
  const visibleTrackLength = Math.max(trackLength - effectiveGap, 0);
  const progressLength = (progressPercent / 100) * visibleTrackLength;
  const remainderLength = circumference - progressLength;
  const primaryStroke = resolveColor(primary, progressPercent);
  const secondaryStroke = resolveColor(secondary, progressPercent, true);

  const circleStyles: CSSProperties = {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeDashoffset: 0,
    transformOrigin: "50% 50%",
    shapeRendering: "geometricPrecision",
  };

  const glowStyles: CSSProperties = glowEffect
    ? {
        filter: [
          `drop-shadow(0 0 2px ${primaryStroke}80)`,
          `drop-shadow(0 0 8px ${primaryStroke}55)`,
          `drop-shadow(0 0 18px ${primaryStroke}25)`,
        ].join(" "),
      }
    : {};

  const ticks = useMemo(() => {
    if (!tickMarks) return null;

    const tickCount = gaugeType === "full" ? 12 : 8;
    return Array.from({ length: tickCount + 1 }, (_, index) => {
      const angle =
        config.startAngle +
        (index / tickCount) * (config.endAngle - config.startAngle);
      const inner = radius - strokeWidth * 0.75;
      const outer = radius + strokeWidth * 0.2;
      const p1 = polarToPoint(angle, inner);
      const p2 = polarToPoint(angle, outer);

      return (
        <line
          key={index}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke="currentColor"
          strokeWidth={index % 3 === 0 ? 1.1 : 0.7}
          opacity={index % 3 === 0 ? 0.32 : 0.18}
        />
      );
    });
  }, [config.endAngle, config.startAngle, gaugeType, radius, strokeWidth, tickMarks]);

  return (
    <div className="relative inline-block">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={config.viewBox}
        width={size}
        height={size}
        style={{ userSelect: "none", ...glowStyles }}
        fill="none"
        className={cn("", typeof className === "string" ? className : className?.svgClassName)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        role="meter"
        {...props}
      >
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={primaryStroke} stopOpacity="0.35" />
              <stop offset="50%" stopColor={primaryStroke} stopOpacity="0.85" />
              <stop offset="100%" stopColor={primaryStroke} stopOpacity="1" />
            </linearGradient>
          </defs>
        )}

        {ticks}

        {multiRing?.enabled &&
          multiRing.rings?.map((ring, index) => {
            const ringRadius = radius - (index + 1) * (strokeWidth + 2);
            const ringCircumference = 2 * Math.PI * ringRadius;
            const ringTrackLength = ringCircumference * config.sweep;
            const ringProgress = (clamp(ring.value, 0, 100) / 100) * ringTrackLength;

            return (
              <circle
                key={`ring-${index}`}
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={ringRadius}
                style={{
                  ...circleStyles,
                  strokeWidth: ring.strokeWidth || Math.max(strokeWidth - 4, 2),
                  strokeDasharray: `${ringProgress} ${ringCircumference - ringProgress}`,
                  transform: `rotate(${config.startAngle}deg)`,
                  stroke: ring.color,
                  opacity: ring.opacity ?? 0.65,
                }}
              />
            );
          })}

        <circle
          cx={circleSize / 2}
          cy={circleSize / 2}
          r={radius}
          style={{
            ...circleStyles,
            strokeWidth,
            strokeDasharray: `${trackLength} ${circumference - trackLength}`,
            transform: `rotate(${config.startAngle}deg)`,
            stroke: secondaryStroke,
          }}
          className={cn("", typeof className === "object" && className?.secondaryClassName)}
        />

        <circle
          cx={circleSize / 2}
          cy={circleSize / 2}
          r={radius}
          style={{
            ...circleStyles,
            strokeWidth,
            strokeDasharray: `${progressLength} ${remainderLength}`,
            transform: `rotate(${config.startAngle}deg)`,
            stroke: gradient ? `url(#${gradientId})` : primaryStroke,
          }}
          className={cn("", typeof className === "object" && className?.primaryClassName)}
        />

        {thresholds?.map((threshold, index) => {
          const thresholdPercent = clamp(((threshold.value - min) / range) * 100, 0, 100);
          const angle =
            config.startAngle +
            (thresholdPercent / 100) * (config.endAngle - config.startAngle);
          const marker = polarToPoint(angle, radius + strokeWidth * 0.75);

          return <circle key={`threshold-${index}`} cx={marker.x} cy={marker.y} r="2" fill={threshold.color} />;
        })}

        {showValue && (
          <text
            x={circleSize / 2}
            y={circleSize / 2 - (label ? 4 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            fontSize={gaugeType === "full" ? 24 : 20}
            fontWeight="700"
            className={cn("font-bold", typeof className === "object" && className?.textClassName)}
            style={{ userSelect: "none" }}
          >
            {animatedValue}
            {showPercentage && unit}
          </text>
        )}

        {label && (
          <text
            x={circleSize / 2}
            y={circleSize / 2 + 17}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={7.5}
            fontWeight="500"
            fill="currentColor"
            opacity="0.58"
            className={cn("", typeof className === "object" && className?.labelClassName)}
            style={{ userSelect: "none" }}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}

export function useNumberCounter({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
}: {
  value: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}) {
  const initialValue = direction === "down" ? value : 0;
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [rawValue, setRawValue] = useState(initialValue);
  const [isInView, setIsInView] = useState(false);

  const motionValue = useMotionValue(initialValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setIsInView(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isInView) return undefined;

    const timeout = window.setTimeout(() => {
      motionValue.set(direction === "down" ? 0 : value);
    }, delay * 1000);

    return () => window.clearTimeout(timeout);
  }, [delay, direction, isInView, motionValue, value]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      const formattedValue = Number(latest.toFixed(decimalPlaces));
      setDisplayValue(formattedValue);
      setRawValue(latest);
    });

    return unsubscribe;
  }, [decimalPlaces, springValue]);

  return {
    formattedValue: Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(displayValue),
    rawValue,
  };
}
