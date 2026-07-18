"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { SuikaGame } from "@/components/games/suika/SuikaGame";
import { SuikaLeaderboard } from "@/components/games/suika/SuikaLeaderboard";

/** Konami code: 5 taps on the title within this window arms bouncy mode. */
const TITLE_TAP_COUNT = 5;
const TITLE_TAP_WINDOW_MS = 2000;

export default function SuikaPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [bouncyTrigger, setBouncyTrigger] = useState(0);
  const tapTimestampsRef = useRef<number[]>([]);

  const handleTitleTap = () => {
    const now = Date.now();
    const recent = tapTimestampsRef.current.filter((t) => now - t < TITLE_TAP_WINDOW_MS);
    recent.push(now);
    if (recent.length >= TITLE_TAP_COUNT) {
      tapTimestampsRef.current = [];
      setBouncyTrigger((n) => n + 1);
    } else {
      tapTimestampsRef.current = recent;
    }
  };

  return (
    <div>
      <button
        onClick={() => router.push("/game")}
        className="mb-2.5 cursor-pointer font-body text-sm font-medium text-orange"
      >
        ‹ back to games
      </button>

      <button
        onClick={handleTitleTap}
        className="mb-4 w-full cursor-pointer select-none text-center font-heading text-lg font-semibold text-ink"
      >
        Suika Game
      </button>

      <div className="mb-4 flex justify-center">
        <SegmentedToggle
          options={[
            { value: "play", label: "play" },
            { value: "leaderboard", label: "leaderboard" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "play" ? (
        <SuikaGame bouncyTrigger={bouncyTrigger} />
      ) : (
        <SuikaLeaderboard />
      )}
    </div>
  );
}
