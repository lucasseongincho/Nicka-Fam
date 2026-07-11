import { Card } from "@/components/ui/Card";

type GameCardProps = {
  title: string;
  subtitle: string;
  emoji: string;
  comingSoon?: boolean;
  onClick?: () => void;
};

export function GameCard({
  title,
  subtitle,
  emoji,
  comingSoon = false,
  onClick,
}: GameCardProps) {
  if (comingSoon) {
    return (
      <Card
        dashed
        className="flex flex-col items-center gap-1.5 px-3 py-5 text-center"
      >
        <span className="text-3xl grayscale">{emoji}</span>
        <p className="font-heading text-sm font-semibold text-ink/50">
          {title}
        </p>
        <span className="rounded-chip border-2 border-ink/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
          coming soon
        </span>
      </Card>
    );
  }

  return (
    <Card
      onClick={onClick}
      className="flex cursor-pointer flex-col items-center gap-1.5 px-3 py-5 text-center transition-transform active:scale-95"
    >
      <span className="text-3xl">{emoji}</span>
      <p className="font-heading text-sm font-semibold text-ink">{title}</p>
      <p className="text-[11px] text-ink/50">{subtitle}</p>
    </Card>
  );
}
