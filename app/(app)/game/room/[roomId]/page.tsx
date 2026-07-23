"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import { GUESS_WHO_MIN_PLAYERS, activeGuessWhoState } from "@/lib/guessWho";
import { joinRoom, leaveLobbyRoom, listenRoom, startRoom } from "@/lib/gameRooms";
import { LADDER_MIN_PLAYERS, activeLadderState } from "@/lib/ladder";
import { MOLE_MIN_PLAYERS, activeMoleGameState } from "@/lib/moleGame";
import { activeTapTapState } from "@/lib/tapTap";
import { activeWhackItState } from "@/lib/whackIt";
import type {
  GameRoom,
  GuessWhoState,
  LadderState,
  MoleGameState,
  TapTapState,
  WhackItState,
} from "@/lib/types";
import { GuessWhoRoom } from "@/components/games/GuessWhoRoom";
import { LadderOutcomeModal } from "@/components/games/ladder/LadderOutcomeModal";
import { LadderRoom } from "@/components/games/ladder/LadderRoom";
import { MoleRoom } from "@/components/games/MoleRoom";
import { RoomLobby } from "@/components/games/RoomLobby";
import { TapTapRoom } from "@/components/games/TapTapRoom";
import { WhackItRoom } from "@/components/games/WhackItRoom";

/** `ladderOutcomes` is only ever passed for the ladder game -- every other game computes its active state with no extra input. */
function startStateFor(gameType: string, players: string[], ladderOutcomes?: string[]): unknown {
  if (gameType === "tap-tap") return activeTapTapState();
  if (gameType === "whack-a-mole") return activeWhackItState();
  if (gameType === "mole") return activeMoleGameState(players);
  if (gameType === "guess-who") return activeGuessWhoState(players);
  if (gameType === "ladder") return activeLadderState(players, ladderOutcomes ?? []);
  return {};
}

function minPlayersFor(gameType: string): number {
  if (gameType === "mole") return MOLE_MIN_PLAYERS;
  if (gameType === "guess-who") return GUESS_WHO_MIN_PLAYERS;
  if (gameType === "ladder") return LADDER_MIN_PLAYERS;
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
    | GameRoom<TapTapState | WhackItState | MoleGameState | GuessWhoState | LadderState>
    | null
    | undefined
  >(undefined);
  const [starting, setStarting] = useState(false);
  const [showLadderOutcomes, setShowLadderOutcomes] = useState(false);
  // Set synchronously the moment the player chooses to leave, so the
  // auto-join effect below doesn't see the leave's own optimistic local
  // snapshot update (players minus this person) and immediately re-add them
  // before the route change unmounts this page.
  const isLeavingRef = useRef(false);

  useEffect(
    () =>
      listenRoom<TapTapState | WhackItState | MoleGameState | GuessWhoState | LadderState>(
        roomId,
        setRoom,
      ),
    [roomId],
  );

  useEffect(() => {
    if (isLeavingRef.current) return;
    if (room && activePersonId && !room.players.includes(activePersonId)) {
      void joinRoom(roomId, activePersonId);
    }
  }, [room, activePersonId, roomId]);

  const handleBack = () => {
    if (room && room.status === "lobby" && activePersonId) {
      isLeavingRef.current = true;
      void leaveLobbyRoom(room.id, activePersonId, room.players, room.createdBy);
    }
    router.push("/game");
  };

  const backLink = (
    <button
      onClick={handleBack}
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
    room.gameType !== "guess-who" &&
    room.gameType !== "ladder"
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

  const handleStart = async (ladderOutcomes?: string[]) => {
    setStarting(true);
    await startRoom(room.id, startStateFor(room.gameType, room.players, ladderOutcomes));
  };

  const isLadder = room.gameType === "ladder";
  const lobbyPlayers = room.players
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is (typeof people)[number] => !!p);

  return (
    <div>
      {backLink}
      {room.status === "lobby" ? (
        <>
          <RoomLobby
            players={room.players}
            createdBy={room.createdBy}
            activePersonId={activePersonId}
            people={people}
            onStart={isLadder ? () => setShowLadderOutcomes(true) : handleStart}
            starting={starting}
            minPlayers={minPlayersFor(room.gameType)}
          />
          {isLadder && showLadderOutcomes && (
            <LadderOutcomeModal
              players={lobbyPlayers}
              onClose={() => setShowLadderOutcomes(false)}
              onSubmit={(outcomes) => {
                setShowLadderOutcomes(false);
                void handleStart(outcomes);
              }}
            />
          )}
        </>
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
        ) : room.gameType === "guess-who" ? (
          <GuessWhoRoom
            room={room as GameRoom<GuessWhoState>}
            people={people}
            activePersonId={activePersonId}
          />
        ) : (
          <LadderRoom
            room={room as GameRoom<LadderState>}
            people={people}
            activePersonId={activePersonId}
          />
        ))
      )}
    </div>
  );
}
