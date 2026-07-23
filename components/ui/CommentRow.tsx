import type { Timestamp } from "firebase/firestore";
import { Avatar } from "@/components/ui/Avatar";
import { formatRelativeTime } from "@/lib/dateUtils";
import type { Person } from "@/lib/types";

/** Generic enough to render a BulletinComment or a PhotoComment -- both are just {text, createdAt} plus an author looked up by the caller. */
export function CommentRow({
  text,
  createdAt,
  author,
  isOwn,
  onDelete,
}: {
  text: string;
  createdAt: Timestamp;
  author: Person | undefined;
  isOwn: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {author ? (
        <Avatar src={author.photoUrl} name={author.name} size="sm" />
      ) : (
        <div className="h-6 w-6 shrink-0 rounded-full bg-ink/10" />
      )}
      <div className="flex-1">
        <p className="text-[13px] text-ink">
          <span className="font-medium">{author?.name ?? "someone"}</span>{" "}
          <span className="text-ink/40">
            · {formatRelativeTime(createdAt?.toDate?.() ?? null)}
          </span>
        </p>
        <p className="text-[13px] text-ink/75">{text}</p>
      </div>
      {isOwn && (
        <button
          onClick={onDelete}
          className="cursor-pointer text-xs font-medium text-ink/40 hover:text-orange"
        >
          delete
        </button>
      )}
    </div>
  );
}
