import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import type { Person } from "@/lib/types";

/**
 * "Who reacted" breakdown, grouped by emoji -- shared between bulletin
 * posts and photos since both store reactions the same way
 * (Record<emoji, personId[]>), so this needed no data model changes, just
 * a place to surface what's already there.
 */
export function ReactionsModal({
  reactions,
  people,
  onClose,
}: {
  reactions: Record<string, string[]>;
  people: Person[];
  onClose: () => void;
}) {
  const groups = Object.entries(reactions)
    .filter(([, ids]) => ids.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <Modal onClose={onClose}>
      <p className="mb-3 text-center font-heading text-lg font-semibold text-ink">
        reactions
      </p>
      <div className="flex flex-col gap-4">
        {groups.map(([emoji, ids]) => (
          <div key={emoji}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
              {emoji} · {ids.length}
            </p>
            <div className="flex flex-col gap-2">
              {ids.map((id) => {
                const person = people.find((p) => p.id === id);
                return (
                  <div key={id} className="flex items-center gap-2">
                    {person ? (
                      <Avatar src={person.photoUrl} name={person.name} size="sm" />
                    ) : (
                      <div className="h-6 w-6 shrink-0 rounded-full bg-ink/10" />
                    )}
                    <span className="text-sm text-ink">{person?.name ?? "someone"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
