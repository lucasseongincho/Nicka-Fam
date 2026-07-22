import { Avatar } from "@/components/ui/Avatar";
import { formatRelativeTime } from "@/lib/dateUtils";
import type { BulletinComment, Person } from "@/lib/types";

export function BulletinCommentRow({
  comment,
  author,
  isOwn,
  onDelete,
}: {
  comment: BulletinComment;
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
            · {formatRelativeTime(comment.createdAt?.toDate?.() ?? null)}
          </span>
        </p>
        <p className="text-[13px] text-ink/75">{comment.text}</p>
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
