"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { createRoom, joinRoom, listenRoomsByType } from "@/lib/gameRooms";
import { lobbyTapTapState } from "@/lib/tapTap";
import type { GameRoom, Person, TapTapState } from "@/lib/types";
import { GameCard } from "@/components/games/GameCard";

export default function GamePage() {
  const router = useRouter();
  const { people, activePersonId } = usePeople();
  const [tapTapRooms, setTapTapRooms] = useState<GameRoom<TapTapState>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => listenRoomsByType<TapTapState>("tap-tap", setTapTapRooms), []);

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name;

  const myTapTapRoom = useMemo(
    () =>
      activePersonId
        ? tapTapRooms.find((r) => r.players.includes(activePersonId))
        : undefined,
    [tapTapRooms, activePersonId],
  );

  const openTapTapLobby = useMemo(
    () => tapTapRooms.find((r) => r.status === "lobby"),
    [tapTapRooms],
  );

  const joinableTapTapRoom = myTapTapRoom ?? openTapTapLobby;
  const joinableTapTapPlayers = joinableTapTapRoom?.players
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p);

  const tapTapSubtitle = loading
    ? "hopping in..."
    : myTapTapRoom
      ? "you're in — back to it"
      : openTapTapLobby
        ? `${nameOf(openTapTapLobby.createdBy) ?? "someone"}'s lobby · join in`
        : "mash it, don't miss";

  const openTapTap = async () => {
    if (!activePersonId || loading) return;
    setLoading(true);
    try {
      if (myTapTapRoom) {
        router.push(`/game/room/${myTapTapRoom.id}`);
        return;
      }
      if (openTapTapLobby) {
        await joinRoom(openTapTapLobby.id, activePersonId);
        router.push(`/game/room/${openTapTapLobby.id}`);
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
        subtitle={tapTapSubtitle}
        emoji="👆"
        onClick={openTapTap}
        players={joinableTapTapPlayers}
      />
      <GameCard title="whack-it" subtitle="reflex chaos" emoji="🔨" comingSoon />
      <GameCard title="the mole" subtitle="find the fibber" emoji="🕵️" comingSoon />
      <GameCard title="mystery, pt. 2" subtitle="soon..." emoji="🃏" comingSoon />
    </div>
  );
}
