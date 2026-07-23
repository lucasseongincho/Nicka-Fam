"use client";

import { useEffect, useState } from "react";
import { CommentRow } from "@/components/ui/CommentRow";
import { EmojiReactionPicker } from "@/components/ui/EmojiReactionPicker";
import { formatRelativeTime } from "@/lib/dateUtils";
import { notifyCategory } from "@/lib/notifyClient";
import {
  addPhotoComment,
  deletePhotoComment,
  listenPhotoComments,
  togglePhotoReaction,
} from "@/lib/photos";
import type { Person, Photo, PhotoComment } from "@/lib/types";

const REPLY_MAX_LENGTH = 200;

export function PhotoCard({
  photo,
  people,
  activePersonId,
  onEdit,
}: {
  photo: Photo;
  people: Person[];
  activePersonId: string;
  onEdit: () => void;
}) {
  const author = people.find((p) => p.id === photo.uploadedBy);
  const me = people.find((p) => p.id === activePersonId);

  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PhotoComment[] | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  // Only subscribe to a photo's replies once its thread is expanded, same
  // reasoning as BulletinPostCard -- a long feed shouldn't hold open a
  // comments listener per photo all at once.
  useEffect(() => {
    if (!showComments) return;
    return listenPhotoComments(photo.id, setComments);
  }, [showComments, photo.id]);

  // recipientOverride personalizes the copy for the photo's owner ("your
  // photo") while everyone else with the category enabled gets the
  // generic version -- same split for both comments and reactions.
  const notifyOwner = (body: string, ownerBody: string) => {
    void notifyCategory({
      category: "photos",
      actorId: activePersonId,
      title: "photos",
      body,
      url: "/photos",
      recipientOverride: photo.uploadedBy !== activePersonId
        ? { personId: photo.uploadedBy, body: ownerBody }
        : undefined,
    });
  };

  const toggleReaction = async (emoji: string, wasActive: boolean) => {
    await togglePhotoReaction(photo.id, emoji, activePersonId, wasActive);
    if (!wasActive) {
      const name = me?.name ?? "someone";
      notifyOwner(`${name} reacted to a photo`, `${name} reacted to your photo`);
    }
  };

  const pickEmoji = async (emoji: string) => {
    setShowPicker(false);
    const reactedAlready = photo.reactions?.[emoji]?.includes(activePersonId) ?? false;
    await toggleReaction(emoji, reactedAlready);
  };

  const submitReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await addPhotoComment(photo.id, activePersonId, trimmed);
    const name = me?.name ?? "someone";
    notifyOwner(`${name} commented on a photo`, `${name} commented on your photo`);
    setReplyText("");
    setBusy(false);
  };

  // reactions/commentCount are absent on photos uploaded before these
  // fields existed -- fall back to empty/zero rather than crashing.
  const reactionEntries = Object.entries(photo.reactions ?? {}).filter(([, ids]) => ids.length > 0);
  const commentCount = photo.commentCount ?? 0;

  return (
    <div className="mb-3.5 overflow-hidden rounded-card border-2 border-ink bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || "shared photo"}
        className="block h-[220px] w-full object-cover"
      />
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-body text-[13px] text-ink">
            {author && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.photoUrl}
                alt={author.name}
                className="h-5 w-5 rounded-full object-cover"
              />
            )}
            <span className="font-medium">{author?.name ?? "someone"}</span>
            <span className="text-ink/40">
              · {formatRelativeTime(photo.createdAt?.toDate?.() ?? null)}
            </span>
          </div>
          <button
            onClick={onEdit}
            className="cursor-pointer text-xs font-medium text-ink/40 hover:text-orange"
          >
            edit
          </button>
        </div>
        {photo.caption && <p className="mt-1 text-sm text-ink/75">{photo.caption}</p>}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {reactionEntries.map(([emoji, ids]) => {
            const active = ids.includes(activePersonId);
            return (
              <button
                key={emoji}
                onClick={() => void toggleReaction(emoji, active)}
                className={`rounded-chip border-2 px-2 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-ink bg-orange/15 text-orange-dark"
                    : "border-ink/15 bg-paper text-ink/60"
                }`}
              >
                {emoji} {ids.length}
              </button>
            );
          })}
          <button
            onClick={() => setShowPicker(true)}
            className="cursor-pointer rounded-chip border-2 border-dashed border-ink/25 px-2 py-1 text-xs font-medium text-ink/40"
          >
            + react
          </button>
          <button
            onClick={() => setShowComments((v) => !v)}
            className="ml-auto cursor-pointer rounded-chip border-2 border-ink/15 bg-paper px-2 py-1 text-xs font-medium text-ink/60"
          >
            💬 {commentCount}
          </button>
        </div>

        {showComments && (
          <div className="mt-2.5 border-t-2 border-ink/10 pt-2.5">
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
                  onDelete={() => void deletePhotoComment(photo.id, comment.id)}
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
      </div>

      {showPicker && <EmojiReactionPicker onPick={pickEmoji} onClose={() => setShowPicker(false)} />}
    </div>
  );
}
