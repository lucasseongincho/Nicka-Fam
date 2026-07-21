import { Button } from "@/components/ui/Button";

export function DinoRunnerResult({
  score,
  isNewPersonalBest,
  isNewGroupBest,
  submitting,
  onRetry,
}: {
  score: number;
  isNewPersonalBest: boolean;
  isNewGroupBest: boolean;
  submitting: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 pt-8 text-center">
      <p className="font-heading text-lg font-semibold text-ink">you scored</p>
      <p className="font-heading text-5xl font-bold text-ink">{score}</p>

      {isNewGroupBest ? (
        <p className="rounded-chip bg-orange px-3 py-1.5 text-[13px] font-semibold text-card">
          🏆 new high score for the whole group!
        </p>
      ) : isNewPersonalBest ? (
        <p className="rounded-chip bg-teal/15 px-3 py-1.5 text-[13px] font-semibold text-teal">
          ✨ new personal best
        </p>
      ) : null}

      <Button onClick={onRetry} disabled={submitting} className="mt-2">
        {submitting ? "saving..." : "run again"}
      </Button>
    </div>
  );
}
