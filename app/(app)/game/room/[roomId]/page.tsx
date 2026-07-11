"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { GUESS_WHO_MIN_PLAYERS, activeGuessWhoState } from "@/lib/guessWho";
import { joinRoom, listenRoom, startRoom } from "@/lib/gameRooms";
import { MOLE_MIN_PLAYERS, activeMoleGameState } from "@/lib/moleGame";
import { activeTapTapState } from "@/lib/tapTap";
import { activeWhackItState } from "@/lib/whackIt";
import type {
  GameRoom,
  GuessWhoState,
  MoleGameState,
  TapTapState,
  WhackItState,
} from "@/lib/types";
import { GuessWhoRoom } from "@/components/games/GuessWhoRoom";
import { MoleRoom } from "@/components/games/MoleRoom";
import { RoomLobby } from "@/components/games/RoomLobby";
import { TapTapRoom } from "@/components/games/TapTapRoom";
import { WhackItRoom } from "@/components/games/WhackItRoom";

function startStateFor(gameType: string, players: string[]): unknown {
  if (gameType === "tap-tap") return activeTapTapState();
  if (gameType === "whack-a-mole") return activeWhackItState();
  if (gameType === "mole") return activeMoleGameState(players);
  if (gameType === "guess-who") return activeGuessWhoState(players);
  return {};
}

function minPlayersFor(gameType: string): number {
  if (gameType === "mole") return MOLE_MIN_PLAYERS;
  if (gameType === "guess-who") return GUESS_WHO_MIN_PLAYERS;
  return 1;
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
    | GameRoom<TapTapState | WhackItState | MoleGameState | GuessWhoState>
    | null
    | undefined
  >(undefined);
  const [starting, setStarting] = useState(false);

  useEffect(
    () =>
      listenRoom<TapTapState | WhackItState | MoleGameState | GuessWhoState>(
        roomId,
        setRoom,
      ),
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

  if (
    room.gameType !== "tap-tap" &&
    room.gameType !== "whack-a-mole" &&
    room.gameType !== "mole" &&
    room.gameType !== "guess-who"
  ) {
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
    await startRoom(room.id, startStateFor(room.gameType, room.players));
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
          minPlayers={minPlayersFor(room.gameType)}
        />
      ) : (
        activePersonId &&
        (room.gameType === "tap-tap" ? (
          <TapTapRoom
            room={room as GameRoom<TapTapState>}
            people={people}
            activePersonId={activePersonId}
          />
        ) : room.gameType === "whack-a-mole" ? (
          <WhackItRoom
            room={room as GameRoom<WhackItState>}
            people={people}
            activePersonId={activePersonId}
          />
        ) : room.gameType === "mole" ? (
          <MoleRoom
            room={room as GameRoom<MoleGameState>}
            people={people}
            activePersonId={activePersonId}
          />
        ) : (
          <GuessWhoRoom
            room={room as GameRoom<GuessWhoState>}
            people={people}
            activePersonId={activePersonId}
          />
        ))
      )}
    </div>
  );
}
