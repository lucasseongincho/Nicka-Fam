"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { usePeople } from "@/contexts/PersonContext";
import { listenDinoRunnerScores } from "@/lib/dinoRunnerScores";
import type { DinoRunnerScoreRecord } from "@/lib/types";

export function DinoRunnerLeaderboard() {
  const { people, activePersonId } = usePeople();
  const [scores, setScores] = useState<DinoRunnerScoreRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => listenDinoRunnerScores(setScores, () => setFailed(true)), []);

  if (failed) {
    return (
      <p className="pt-10 text-center text-ink/40">
        couldn&apos;t load the leaderboard right now.
      </p>
    );
  }

  if (scores === null) {
    return <p className="pt-10 text-center text-ink/40">loading leaderboard...</p>;
  }

  if (scores.length === 0) {
    return <p className="pt-10 text-center text-ink/40">no scores yet — be the first</p>;
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      {scores.map((s, i) => {
        const person = people.find((p) => p.id === s.personId);
        if (!person) return null;
        return (
          <Card
            key={s.personId}
            className={`flex items-center justify-between px-3.5 py-2.5 ${
              s.personId === activePersonId ? "border-orange" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="font-heading text-sm font-semibold text-ink/40">
                #{i + 1}
              </span>
              <Avatar src={person.photoUrl} name={person.name} size="md" />
              <span className="font-heading text-base font-semibold text-ink">
                {person.name}
                {i === 0 && " 🏆"}
              </span>
            </div>
            <span className="font-heading text-lg font-bold text-ink">{s.bestScore}</span>
          </Card>
        );
      })}
    </div>
  );
}
