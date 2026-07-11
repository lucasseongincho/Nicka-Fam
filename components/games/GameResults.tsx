import { Card } from "@/components/ui/Card";

export function GameResults({
  results,
  nameOf,
  tagline,
}: {
  results: { id: string; count: number }[];
  nameOf: (id: string) => string;
  tagline: string;
}) {
  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <p className="mb-1 font-heading text-xl font-semibold text-ink">
        results are in
      </p>
      <p className="mb-5 text-[13px] text-ink/50">{tagline}</p>

      <div className="w-full">
        {results.map((r, i) => (
          <Card
            key={r.id}
            className={`mb-2 flex items-center justify-between px-3.5 py-2.5 ${
              i === 0 ? "border-orange" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold text-ink/40">
                #{i + 1}
              </span>
              <span className="font-heading text-base font-semibold text-ink">
                {nameOf(r.id)}
                {i === 0 && " 🏆"}
                {results.length > 1 && i === results.length - 1 && " 💀"}
              </span>
            </div>
            <span className="font-heading text-lg font-bold text-ink">
              {r.count}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
