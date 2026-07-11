"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { joinRoom, listenRoom, startRoom } from "@/lib/gameRooms";
import { activeTapTapState } from "@/lib/tapTap";
import { activeWhackItState } from "@/lib/whackIt";
import type { GameRoom, TapTapState, WhackItState } from "@/lib/types";
import { RoomLobby } from "@/components/games/RoomLobby";
import { TapTapRoom } from "@/components/games/TapTapRoom";
import { WhackItRoom } from "@/components/games/WhackItRoom";

function startStateFor(gameType: string): unknown {
  if (gameType === "tap-tap") return activeTapTapState();
  if (gameType === "whack-a-mole") return activeWhackItState();
  return {};
}

export default function GameRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { people, activePersonId } = usePeople();
  const [room, setRoom] = useState<
    GameRoom<TapTapState | WhackItState> | null | undefined
  >(undefined);
  const [starting, setStarting] = useState(false);

  useEffect(
    () => listenRoom<TapTapState | WhackItState>(roomId, setRoom),
    [roomId],
  );

  useEffect(() => {
    if (room && activePersonId && !room.players.includes(activePersonId)) {
      void joinRoom(roomId, activePersonId);
    }
  }, [room, activePersonId, roomId]);

  const backLink = (
    <button
      onClick={() => router.push("/game")}
      className="mb-2.5 cursor-pointer font-body text-sm font-medium text-orange"
    >
      ‹ back to games
    </button>
  );

  if (room === undefined) {
    return <p className="pt-10 text-center text-ink/40">loading room...</p>;
  }

  if (room === null) {
    return (
      <div>
        {backLink}
        <p className="pt-10 text-center text-ink/40">
          this room doesn&apos;t exist anymore.
        </p>
      </div>
    );
  }

  if (room.gameType !== "tap-tap" && room.gameType !== "whack-a-mole") {
    return (
      <div>
        {backLink}
        <p className="pt-10 text-center text-ink/40">
          this game isn&apos;t ready to play yet.
        </p>
      </div>
    );
  }

  const handleStart = async () => {
    setStarting(true);
    await startRoom(room.id, startStateFor(room.gameType));
  };

  return (
    <div>
      {backLink}
      {room.status === "lobby" ? (
        <RoomLobby
          players={room.players}
          createdBy={room.createdBy}
          activePersonId={activePersonId}
          people={people}
          onStart={handleStart}
          starting={starting}
        />
      ) : (
        activePersonId &&
        (room.gameType === "tap-tap" ? (
          <TapTapRoom
            room={room as GameRoom<TapTapState>}
            people={people}
            activePersonId={activePersonId}
          />
        ) : (
          <WhackItRoom
            room={room as GameRoom<WhackItState>}
            people={people}
            activePersonId={activePersonId}
          />
        ))
      )}
    </div>
  );
}
