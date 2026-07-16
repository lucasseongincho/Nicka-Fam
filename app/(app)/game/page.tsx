"use client";

import { useRouter } from "next/navigation";
import { useJoinableGame } from "@/components/games/useJoinableGame";
import { GameCard } from "@/components/games/GameCard";
import { lobbyGuessWhoState } from "@/lib/guessWho";
import { lobbyMoleGameState } from "@/lib/moleGame";
import { lobbyTapTapState } from "@/lib/tapTap";
import { lobbyWhackItState } from "@/lib/whackIt";
import type { GuessWhoState, MoleGameState, TapTapState, WhackItState } from "@/lib/types";

export default function GamePage() {
  const router = useRouter();
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
        iconSrc="/games/red-button.png"
        onClick={tapTap.onClick}
        players={tapTap.players}
      />
      <GameCard
        title="whack a mole"
        subtitle={whackIt.subtitle}
        iconSrc="/games/mole.png"
        onClick={whackIt.onClick}
        players={whackIt.players}
      />
      <GameCard
        title="liar game"
        subtitle={mole.subtitle}
        iconSrc="/games/liar.png"
        onClick={mole.onClick}
        players={mole.players}
      />
      <GameCard
        title="guess who?"
        subtitle={guessWho.subtitle}
        iconSrc="/games/guess-who.png"
        onClick={guessWho.onClick}
        players={guessWho.players}
      />
      <GameCard
        title="수박게임"
        subtitle="solo · merge to the melon"
        iconSrc="/suika-faces/11.png"
        onClick={() => router.push("/game/suika")}
      />
    </div>
  );
}
