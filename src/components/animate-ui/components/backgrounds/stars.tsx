"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Star {
  x: number;
  y: number;
  r: number;
  // base alpha + twinkle phase
  a: number;
  p: number;
  // gentle drift
  dx: number;
  dy: number;
}

interface StarsBackgroundProps {
  className?: string;
  /** Color of the stars (hex/rgb). Defaults to white. */
  starColor?: string;
  /** Density factor: stars per 10,000 px². Default 0.45 */
  density?: number;
  /** Children render on top of the canvas. */
  children?: React.ReactNode;
}

/**
 * Lightweight animated stars background. Renders into a canvas that fills
 * the parent. Designed to sit behind page content.
 */
export const StarsBackground = ({
  className,
  starColor = "#FFFFFF",
  density = 0.45,
  children,
}: StarsBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const initStars = () => {
      const count = Math.max(60, Math.floor((width * height) / 10000 * density));
      const stars: Star[] = new Array(count);
      for (let i = 0; i < count; i++) {
        stars[i] = {
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.2 + 0.2,
          a: Math.random() * 0.6 + 0.2,
          p: Math.random() * Math.PI * 2,
          dx: (Math.random() - 0.5) * 0.04,
          dy: (Math.random() - 0.5) * 0.04,
        };
      }
      starsRef.current = stars;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // twinkle
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.0015 + s.p);
        const alpha = Math.max(0, Math.min(1, s.a * twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(starColor, alpha);
        ctx.fill();
        // drift
        s.x += s.dx;
        s.y += s.dy;
        if (s.x < -2) s.x = width + 2;
        else if (s.x > width + 2) s.x = -2;
        if (s.y < -2) s.y = height + 2;
        else if (s.y > height + 2) s.y = -2;
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    rafRef.current = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [starColor, density]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      {children}
    </div>
  );
};

/** Convert hex/rgb color to rgba with given alpha. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const full = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex.padEnd(6, "0").slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith("rgb")) {
    return color.replace(/rgba?\(([^)]+)\)/, (_, body) => {
      const parts = body.split(",").map((p: string) => p.trim());
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    });
  }
  return color;
}

export default StarsBackground;
