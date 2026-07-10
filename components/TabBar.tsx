"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = ["split", "calendar", "photos", "game"] as const;

function TabIcon({ tab, active }: { tab: (typeof TABS)[number]; active: boolean }) {
  const activeColor = "#EA5A32";
  const inactiveColor = "rgba(36,28,22,0.3)";

  if (tab === "split") {
    return (
      <div
        className="h-[22px] w-[22px] rounded-full"
        style={{ background: active ? activeColor : "rgba(36,28,22,0.15)" }}
      />
    );
  }

  const borderColor = active ? activeColor : inactiveColor;

  if (tab === "calendar") {
    return (
      <div
        className="relative h-[22px] w-[22px] rounded-md border-2"
        style={{ borderColor }}
      >
        <div
          className="absolute -top-1 left-1 h-1.5 w-[3px] rounded-sm"
          style={{ background: borderColor }}
        />
        <div
          className="absolute -top-1 right-1 h-1.5 w-[3px] rounded-sm"
          style={{ background: borderColor }}
        />
      </div>
    );
  }

  if (tab === "photos") {
    return (
      <div
        className="relative h-[22px] w-[22px] overflow-hidden rounded-md border-2"
        style={{ borderColor }}
      >
        <div
          className="absolute left-[3px] top-[3px] h-1.5 w-1.5 rounded-full"
          style={{ background: borderColor }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-[22px] w-[22px] rounded-md border-2" style={{ borderColor }}>
      <div
        className="absolute left-1 top-1 h-[3px] w-[3px] rounded-full"
        style={{ background: borderColor }}
      />
      <div
        className="absolute bottom-1 right-1 h-[3px] w-[3px] rounded-full"
        style={{ background: borderColor }}
      />
    </div>
  );
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <div className="flex border-t-2 border-ink bg-paper pb-6">
      {TABS.map((tab) => {
        const active = pathname.startsWith(`/${tab}`);
        return (
          <Link
            key={tab}
            href={`/${tab}`}
            className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5"
          >
            <TabIcon tab={tab} active={active} />
            <span
              className={`text-xs ${
                active ? "font-semibold text-orange" : "font-normal text-ink/45"
              }`}
            >
              {tab}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
