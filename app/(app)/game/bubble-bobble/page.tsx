"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { BubbleBobbleGame } from "@/components/games/bubbleBobble/BubbleBobbleGame";
import { BubbleBobbleLeaderboard } from "@/components/games/bubbleBobble/BubbleBobbleLeaderboard";

export default function BubbleBobblePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"play" | "leaderboard">("play");

  return (
    <div>
      <button
        onClick={() => router.push("/game")}
        className="mb-2.5 cursor-pointer font-body text-sm font-medium text-orange"
      >
        ‹ back to games
      </button>

      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        Bubble Bobble
      </p>

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

      {tab === "play" ? <BubbleBobbleGame /> : <BubbleBobbleLeaderboard />}
    </div>
  );
}
