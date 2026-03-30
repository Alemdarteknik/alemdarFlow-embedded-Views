"use client";

import { useEffect, useMemo, useState } from "react";

type TimePhase = "day" | "night";

function getTimePhase(): TimePhase {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

/** Seeded PRNG (mulberry32) — deterministic across renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStars(count: number) {
  const rand = mulberry32(42);
  const stars: {
    top: string;
    left: string;
    size: number;
    delay: string;
    opacity: number;
  }[] = [];
  for (let i = 0; i < count; i++) {
    const inNavbar = i < count * 0.65;
    const top = inNavbar
      ? (rand() * 85).toFixed(2)
      : (85 + rand() * 335).toFixed(2);
    const left = (rand() * 96 + 2).toFixed(2);
    const size = inNavbar ? 2 + rand() * 3.5 : 1.5 + rand() * 2.5;
    const delay = `${(rand() * 6).toFixed(2)}s`;
    const opacity = inNavbar ? 0.65 + rand() * 0.35 : 0.35 + rand() * 0.45;
    stars.push({ top: `${top}px`, left: `${left}%`, size, delay, opacity });
  }
  return stars;
}

export function DaySun() {
  const [phase, setPhase] = useState<TimePhase>(() => getTimePhase());

  const stars = useMemo(() => generateStars(80), []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(getTimePhase());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  if (phase === "day") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-1 -translate-x-1/2 -translate-y-[60%]"
      >
        <div className="day-sun-orb h-28 w-28 md:h-40 md:w-40 lg:h-50 lg:w-50 rounded-full bg-yellow-300" />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-1 h-[420px] overflow-hidden"
    >
      {/* Full moon — top right */}
      <div className="absolute right-8 top-3 md:right-16 md:top-4">
        <div className="night-moon h-14 w-14 rounded-full bg-gray-100 shadow-[0_0_24px_10px_rgba(255,255,255,0.3)]" />
      </div>

      {stars.map((star, i) => (
        <span
          key={i}
          className="night-star absolute rounded-full bg-white"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}
