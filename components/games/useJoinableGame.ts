"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { createRoom, joinRoom, listenRoomsByType } from "@/lib/gameRooms";
import type { GameRoom, GameType, Person } from "@/lib/types";

/**
 * Drives a game's catalog card: live lobby visibility (who's already in,
 * whose lobby it is, or that you're already in a room) plus the
 * create-or-join-or-resume tap handler. Shared so every game gets the same
 * behavior -- including the "don't act until the first snapshot has
 * actually loaded" guard, which closes a real race where a click right
 * after the page mounts could spin up a duplicate room.
 */
export function useJoinableGame<TState>(
  gameType: GameType,
  initialLobbyState: () => TState,
  defaultSubtitle: string,
) {
  const router = useRouter();
  const { people, activePersonId } = usePeople();
  const [rooms, setRooms] = useState<GameRoom<TState>[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => listenRoomsByType<TState>(gameType, setRooms), [gameType]);

  const roomsLoaded = rooms !== null;

  const myRoom = useMemo(
    () => (activePersonId ? rooms?.find((r) => r.players.includes(activePersonId)) : undefined),
    [rooms, activePersonId],
  );

  const openLobby = useMemo(() => rooms?.find((r) => r.status === "lobby"), [rooms]);

  const joinableRoom = myRoom ?? openLobby;
  const players = joinableRoom?.players
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p);

  const hostName = openLobby ? people.find((p) => p.id === openLobby.createdBy)?.name : undefined;

  const subtitle = !roomsLoaded
    ? "loading..."
    : loading
      ? "hopping in..."
      : myRoom
        ? "you're in — back to it"
        : openLobby
          ? `${hostName ?? "someone"}'s lobby · join in`
          : defaultSubtitle;

  const onClick = async () => {
    if (!activePersonId || loading || !roomsLoaded) return;
    setLoading(true);
    try {
      if (myRoom) {
        router.push(`/game/room/${myRoom.id}`);
        return;
      }
      if (openLobby) {
        await joinRoom(openLobby.id, activePersonId);
        router.push(`/game/room/${openLobby.id}`);
        return;
      }
      const roomId = await createRoom(gameType, activePersonId, initialLobbyState());
      router.push(`/game/room/${roomId}`);
    } finally {
      setLoading(false);
    }
  };

  return { subtitle, players, onClick };
}
