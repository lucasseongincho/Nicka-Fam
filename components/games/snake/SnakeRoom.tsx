import type { GameRoom, Person, SnakeState } from "@/lib/types";
import { SnakeArena } from "@/components/games/snake/SnakeArena";

export function SnakeRoom({
  room,
  people,
  activePersonId,
  onLeave,
}: {
  room: GameRoom<SnakeState>;
  people: Person[];
  activePersonId: string;
  onLeave: () => void;
}) {
  const activePerson = people.find((p) => p.id === activePersonId);
  if (!activePerson) return null;

  return (
    <SnakeArena
      roomId={room.id}
      activePerson={activePerson}
      isHost={room.createdBy === activePersonId}
      people={people}
      onLeave={onLeave}
    />
  );
}
