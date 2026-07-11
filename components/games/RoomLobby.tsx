import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Person } from "@/lib/types";

export function RoomLobby({
  players,
  createdBy,
  activePersonId,
  people,
  onStart,
  starting,
  minPlayers = 1,
}: {
  players: string[];
  createdBy: string;
  activePersonId: string | null;
  people: Person[];
  onStart: () => void;
  starting: boolean;
  minPlayers?: number;
}) {
  const isHost = activePersonId === createdBy;
  const nameOf = (id: string) => people.find((p) => p.id === id);
  const host = nameOf(createdBy);
  const needsMorePlayers = players.length < minPlayers;

  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <p className="mb-1 font-heading text-lg font-semibold text-ink">lobby</p>
      <p className="mb-5 text-[13px] text-ink/50">
        waiting for {isHost ? "you to hit start" : "the host to start"}
      </p>

      <Card className="mb-6 flex w-full flex-wrap justify-center gap-4 px-4 py-5">
        {players.map((id) => {
          const person = nameOf(id);
          if (!person) return null;
          return (
            <div key={id} className="flex flex-col items-center gap-1.5">
              <Avatar src={person.photoUrl} name={person.name} size="lg" />
              <span className="text-xs font-medium text-ink/70">
                {person.name}
                {id === createdBy && " 👑"}
              </span>
            </div>
          );
        })}
      </Card>

      {needsMorePlayers ? (
        <p className="text-sm text-ink/45">
          need at least {minPlayers} players to start &middot; {players.length} joined
        </p>
      ) : isHost ? (
        <Button onClick={onStart} disabled={starting}>
          {starting ? "starting..." : "start game"}
        </Button>
      ) : (
        <p className="text-sm text-ink/45">
          hang tight, {host?.name ?? "the host"} will kick it off
        </p>
      )}
    </div>
  );
}
