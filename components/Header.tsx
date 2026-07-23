"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Mascot } from "@/components/ui/Mascot";
import { SettingsModal } from "@/components/SettingsModal";

const META: Record<string, { title: string; sub: string }> = {
  "/split": { title: "split", sub: "who owes who, sorted" },
  "/calendar": { title: "plans", sub: "stuff we're actually doing" },
  "/photos": { title: "the goods", sub: "the shared shame folder" },
  "/game": { title: "game", sub: "pick your chaos" },
  "/board": { title: "board", sub: "pin your thoughts" },
};

export function Header() {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const meta =
    Object.entries(META).find(([prefix]) => pathname.startsWith(prefix))?.[1] ??
    META["/split"];

  return (
    <div className="flex items-start justify-between px-5 pb-2.5 pt-5">
      <div>
        <h1 className="font-heading text-[27px] font-bold text-ink">
          {meta.title}
        </h1>
        <p className="mt-0.5 text-[13px] text-ink/50">{meta.sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          className="cursor-pointer text-lg text-ink/40 hover:text-orange"
        >
          ⚙
        </button>
        <Mascot size={30} />
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
