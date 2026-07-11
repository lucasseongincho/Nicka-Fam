"use client";

import { useJoinableGame } from "@/components/games/useJoinableGame";
import { GameCard } from "@/components/games/GameCard";
import { lobbyGuessWhoState } from "@/lib/guessWho";
import { lobbyMoleGameState } from "@/lib/moleGame";
import { lobbyTapTapState } from "@/lib/tapTap";
import { lobbyWhackItState } from "@/lib/whackIt";
import type { GuessWhoState, MoleGameState, TapTapState, WhackItState } from "@/lib/types";

export default function GamePage() {
  const tapTap = useJoinableGame<TapTapState>(
    "tap-tap",
    lobbyTapTapState,
    "mash it, don't miss",
  );
  const whackIt = useJoinableGame<WhackItState>(
    "whack-a-mole",
    lobbyWhackItState,
    "quick hands only",
  );
  const mole = useJoinableGame<MoleGameState>(
    "mole",
    lobbyMoleGameState,
    "find the fibber",
  );
  const guessWho = useJoinableGame<GuessWhoState>(
    "guess-who",
    lobbyGuessWhoState,
    "forehead cards, no peeking",
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <GameCard
        title="tap tap"
        subtitle={tapTap.subtitle}
        emoji="👆"
        onClick={tapTap.onClick}
        players={tapTap.players}
      />
      <GameCard
        title="whack-it"
        subtitle={whackIt.subtitle}
        emoji="🔨"
        onClick={whackIt.onClick}
        players={whackIt.players}
      />
      <GameCard
        title="the mole"
        subtitle={mole.subtitle}
        emoji="🕵️"
        onClick={mole.onClick}
        players={mole.players}
      />
      <GameCard
        title="guess who?"
        subtitle={guessWho.subtitle}
        emoji="🤔"
        onClick={guessWho.onClick}
        players={guessWho.players}
      />
    </div>
  );
}
