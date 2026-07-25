import { Card } from "@/components/ui/Card";
import type { SnakeLeaderboardEntry } from "@/components/games/snake/useSnakeEngine";

export function SnakeHud({ leaderboard }: { leaderboard: SnakeLeaderboardEntry[] }) {
  return (
    <Card className="mt-3 p-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">
        leaderboard
      </p>
      {leaderboard.length === 0 ? (
        <p className="py-1 text-sm text-ink/40">getting everyone in place...</p>
      ) : (
        leaderboard.map((entry, i) => (
          <div key={entry.id} className="flex items-center justify-between py-1 text-sm">
            <span
              className={`flex items-center gap-1.5 ${
                entry.isSelf ? "font-semibold text-orange" : "text-ink/75"
              }`}
            >
              <span className="w-4 text-ink/40">{i + 1}</span>
              {entry.name}
              {entry.isBot && <span className="text-xs">🤖</span>}
            </span>
            <span className="font-heading font-semibold text-ink">{entry.score}</span>
          </div>
        ))
      )}
    </Card>
  );
}
