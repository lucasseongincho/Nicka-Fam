"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/split", label: "split" },
  { href: "/calendar", label: "calendar" },
  { href: "/photos", label: "photos" },
  { href: "/game", label: "game" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <div className="flex border-t-2 border-ink bg-paper pb-6">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5"
          >
            <div
              className={`h-[22px] w-[22px] rounded-md border-2 ${
                active ? "border-orange bg-orange" : "border-ink/30 bg-transparent"
              }`}
            />
            <span
              className={`text-xs ${
                active ? "font-semibold text-orange" : "font-normal text-ink/45"
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
