import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import type { Person } from "@/lib/types";

type GameCardProps = {
  title: string;
  subtitle: string;
  /** Emoji fallback, shown if no iconSrc is given. */
  emoji?: string;
  /** Icon image, e.g. from /public/games. Takes priority over emoji. */
  iconSrc?: string;
  comingSoon?: boolean;
  onClick?: () => void;
  /** Who's already in the joinable/active room for this game, if any. */
  players?: Person[];
};

function CardIcon({
  emoji,
  iconSrc,
  grayscale = false,
}: {
  emoji?: string;
  iconSrc?: string;
  grayscale?: boolean;
}) {
  if (iconSrc) {
    return (
      <Image
        src={iconSrc}
        alt=""
        width={48}
        height={48}
        className={`h-12 w-12 rounded-card-sm border-2 border-ink object-cover ${grayscale ? "grayscale" : ""}`}
      />
    );
  }
  return <span className={`text-3xl ${grayscale ? "grayscale" : ""}`}>{emoji}</span>;
}

export function GameCard({
  title,
  subtitle,
  emoji,
  iconSrc,
  comingSoon = false,
  onClick,
  players,
}: GameCardProps) {
  if (comingSoon) {
    return (
      <Card
        dashed
        className="flex flex-col items-center gap-1.5 px-3 py-5 text-center"
      >
        <CardIcon emoji={emoji} iconSrc={iconSrc} grayscale />
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
      <CardIcon emoji={emoji} iconSrc={iconSrc} />
      <p className="font-heading text-sm font-semibold text-ink">{title}</p>
      {players && players.length > 0 && (
        <div className="flex">
          {players.slice(0, 4).map((p) => (
            <Avatar key={p.id} src={p.photoUrl} name={p.name} size="sm" overlap />
          ))}
        </div>
      )}
      <p className="text-[11px] text-ink/50">{subtitle}</p>
    </Card>
  );
}
