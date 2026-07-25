"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { addSetlogComment, listenSetlogCommentsForClip } from "@/lib/setlog";
import type { Person, SetlogClip, SetlogComment } from "@/lib/types";

const QUICK_EMOJI = ["😂", "❤️", "😭", "✨", "🥺"];
const COMMENT_MAX_LENGTH = 200;

/** Per-clip comment thread -- tapping any box (yours or someone else's) opens this. */
export function SetlogCommentSheet({
  clip,
  people,
  activePersonId,
  onClose,
}: {
  clip: SetlogClip;
  people: Person[];
  activePersonId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<SetlogComment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const author = people.find((p) => p.id === clip.personId);

  useEffect(() => listenSetlogCommentsForClip(clip.id, setComments), [clip.id]);

  const post = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await addSetlogComment(clip.id, clip.slotId, activePersonId, trimmed);
    setText("");
    setBusy(false);
  };

  return (
    <Modal onClose={onClose}>
      <div className="mb-3 flex items-center gap-2">
        <Avatar src={author?.photoUrl ?? ""} name={author?.name ?? "someone"} size="sm" />
        <p className="font-heading text-sm font-semibold text-ink">{author?.name ?? "someone"}&apos;s clip</p>
      </div>

      <video
        src={clip.videoUrl}
        autoPlay
        muted
        loop
        playsInline
        controls
        className="mb-2 aspect-[9/16] w-full rounded-card-sm border-2 border-ink object-cover"
      />
      {clip.caption && <p className="mb-3 text-sm text-ink/75">{clip.caption}</p>}

      <div className="mb-3 max-h-[220px] overflow-y-auto">
        {comments === null ? (
          <p className="text-xs text-ink/40">loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-ink/40">no comments yet</p>
        ) : (
          comments.map((c) => {
            const commenter = people.find((p) => p.id === c.personId);
            const isOwn = c.personId === activePersonId;
            return (
              <div
                key={c.id}
                className={`mb-2 flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {!isOwn && (
                  <Avatar src={commenter?.photoUrl ?? ""} name={commenter?.name ?? "someone"} size="sm" />
                )}
                <div
                  className={`max-w-[75%] rounded-card-sm px-3 py-1.5 ${
                    isOwn ? "bg-orange text-card" : "border-2 border-ink/10 bg-paper text-ink"
                  }`}
                >
                  {!isOwn && (
                    <p className="mb-0.5 text-[11px] font-semibold text-ink/50">
                      {commenter?.name ?? "someone"}
                    </p>
                  )}
                  <p className="text-[13px]">{c.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mb-2 flex gap-1.5">
        {QUICK_EMOJI.map((emoji) => (
          <button
            key={emoji}
            onClick={() => void post(emoji)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-ink/15 bg-paper text-base"
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void post(text);
          }}
          placeholder="message..."
          className="flex-1 rounded-pill border-2 border-ink/20 bg-paper px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink/35"
        />
        <button
          onClick={() => void post(text)}
          disabled={busy || !text.trim()}
          className="cursor-pointer rounded-pill border-2 border-ink bg-orange px-4 py-2 text-xs font-semibold text-card disabled:opacity-40"
        >
          send
        </button>
      </div>
    </Modal>
  );
}
