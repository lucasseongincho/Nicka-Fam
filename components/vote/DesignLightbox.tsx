"use client";

import { useEffect, useState } from "react";
import type { DesignComment, Person, VoteDesign } from "@/lib/types";
import {
  addDesignComment,
  deleteDesignComment,
  listenDesignComments,
} from "@/lib/votes";
import { CommentRow } from "@/components/ui/CommentRow";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const REPLY_MAX_LENGTH = 200;

export function DesignLightbox({
  design,
  people,
  activePersonId,
  isMyVote,
  canVote,
  canRemove,
  onVote,
  onRemove,
  onClose,
}: {
  design: VoteDesign;
  people: Person[];
  activePersonId: string;
  isMyVote: boolean;
  canVote: boolean;
  canRemove: boolean;
  onVote: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<DesignComment[] | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!showComments) return;
    return listenDesignComments(design.id, setComments);
  }, [showComments, design.id]);

  const commentCount = design.commentCount ?? 0;

  const submitReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await addDesignComment(design.id, activePersonId, trimmed);
    setReplyText("");
    setBusy(false);
  };

  return (
    <Modal onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={design.imageUrl}
        alt="submitted design"
        className="mb-4 max-h-[55vh] w-full rounded-card-sm border-2 border-ink bg-paper object-contain"
      />

      <div className="mb-4 flex items-center justify-between">
        <span className="font-heading text-base font-semibold text-ink">
          ❤ {design.voteCount} {design.voteCount === 1 ? "vote" : "votes"}
        </span>
        {isMyVote && (
          <span className="rounded-chip border-2 border-ink bg-orange/15 px-2.5 py-1 text-xs font-semibold text-orange-dark">
            ✓ your pick
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2.5">
        {canVote && !isMyVote && <Button onClick={onVote}>vote for this design</Button>}
        {canRemove && (
          <Button variant="ghost" className="text-orange-dark" onClick={onRemove}>
            remove my design
          </Button>
        )}
      </div>

      <button
        onClick={() => setShowComments((v) => !v)}
        className="mb-2 cursor-pointer rounded-chip border-2 border-ink/15 bg-paper px-2 py-1 text-xs font-medium text-ink/60"
      >
        💬 {commentCount}
      </button>

      {showComments && (
        <div className="mb-4 border-t-2 border-ink/10 pt-2.5">
          {comments === null ? (
            <p className="text-xs text-ink/40">loading replies...</p>
          ) : (
            comments.map((comment) => (
              <CommentRow
                key={comment.id}
                text={comment.text}
                createdAt={comment.createdAt}
                author={people.find((p) => p.id === comment.authorId)}
                isOwn={activePersonId === comment.authorId}
                onDelete={() => void deleteDesignComment(design.id, comment.id)}
              />
            ))
          )}
          <div className="mt-1.5 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, REPLY_MAX_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitReply();
              }}
              placeholder="reply..."
              className="flex-1 rounded-pill border-2 border-ink/20 bg-paper px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink/35"
            />
            <button
              onClick={submitReply}
              disabled={busy || !replyText.trim()}
              className="cursor-pointer rounded-pill border-2 border-ink bg-orange px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-40"
            >
              reply
            </button>
          </div>
        </div>
      )}

      <Button variant="ghost" className="w-full" onClick={onClose}>
        close
      </Button>
    </Modal>
  );
}
