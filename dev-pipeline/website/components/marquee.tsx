"use client";

import type { ReactNode } from "react";

export type MarqueeItem = {
  label: string;
  icon?: ReactNode;
};

type MarqueeProps = {
  items: MarqueeItem[];
  duration?: number;
};

export function Marquee({ items, duration = 36 }: MarqueeProps) {
  return (
    <div className="marquee" role="presentation">
      <div
        className="marquee-track pause-on-hover"
        style={{ animationDuration: `${duration}s` }}
      >
        {[...items, ...items].map((item, index) => (
          <span className="marquee-item" key={`${item.label}-${index}`}>
            {item.icon}
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}