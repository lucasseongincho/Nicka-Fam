"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { createRoom, findMyActiveRoom, findOpenRoom, joinRoom } from "@/lib/gameRooms";
import { lobbyTapTapState } from "@/lib/tapTap";
import { GameCard } from "@/components/games/GameCard";

export default function GamePage() {
  const router = useRouter();
  const { activePersonId } = usePeople();
  const [loading, setLoading] = useState(false);

  const openTapTap = async () => {
    if (!activePersonId || loading) return;
    setLoading(true);
    try {
      const mine = await findMyActiveRoom("tap-tap", activePersonId);
      if (mine) {
        router.push(`/game/room/${mine}`);
        return;
      }
      const open = await findOpenRoom("tap-tap");
      if (open) {
        await joinRoom(open, activePersonId);
        router.push(`/game/room/${open}`);
        return;
      }
      const roomId = await createRoom("tap-tap", activePersonId, lobbyTapTapState());
      router.push(`/game/room/${roomId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <GameCard
        title="tap tap"
        subtitle={loading ? "hopping in..." : "mash it, don't miss"}
        emoji="👆"
        onClick={openTapTap}
      />
      <GameCard title="whack-it" subtitle="reflex chaos" emoji="🔨" comingSoon />
      <GameCard title="the mole" subtitle="find the fibber" emoji="🕵️" comingSoon />
      <GameCard title="mystery, pt. 2" subtitle="soon..." emoji="🃏" comingSoon />
    </div>
  );
}
