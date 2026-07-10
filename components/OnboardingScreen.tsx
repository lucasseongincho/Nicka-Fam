"use client";

import { useState, type MouseEvent } from "react";
import { Mascot } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";

export function OnboardingScreen({ onContinue }: { onContinue: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setPos({ x, y });
  };

  return (
    <div
      onMouseMove={handleMove}
      className="relative flex min-h-screen flex-col overflow-hidden bg-paper pt-14"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-8 h-56 w-56 opacity-30"
        style={{
          background: "var(--color-teal)",
          borderRadius: "45% 55% 60% 40% / 50% 45% 55% 50%",
          transform: `translate(${pos.x * 8}px, ${pos.y * 8}px)`,
        }}
      />
      <div
        className="pointer-events-none absolute bottom-40 -left-14 h-40 w-40 opacity-85"
        style={{
          background: "var(--color-orange)",
          borderRadius: "60% 40% 45% 55% / 45% 55% 40% 60%",
          transform: `translate(${pos.x * 18}px, ${pos.y * 18}px)`,
        }}
      />
      <div
        className="pointer-events-none absolute left-10 top-40 h-4 w-4 rounded-full bg-ink/80"
        style={{ transform: `translate(${pos.x * 26}px, ${pos.y * 26}px)` }}
      />
      <div
        className="pointer-events-none absolute bottom-64 right-12 h-5 w-5 rounded-[40%] bg-ink/15"
        style={{
          transform: `translate(${pos.x * 18}px, ${pos.y * 26}px) rotate(20deg)`,
        }}
      />

      <div className="relative z-10 px-6 font-heading text-base font-bold tracking-wide text-ink">
        nicka fam
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        <div
          style={{ transform: `translate(${pos.x * 8}px, ${pos.y * 14}px)` }}
        >
          <Mascot size={118} mouth />
        </div>
        <h1 className="font-heading text-4xl font-bold leading-tight text-ink sm:text-5xl">
          welcome to
          <br />
          nicka fam
        </h1>
        <p className="max-w-sm text-base leading-relaxed text-ink/60">
          the group that actually settles up. mostly bills, some chaos,
          occasional beach day.
        </p>
      </div>

      <div className="relative z-10 px-8 pb-12">
        <Button onClick={onContinue} className="w-full text-[17px]">
          let&apos;s get in 👋
        </Button>
      </div>
    </div>
  );
}
