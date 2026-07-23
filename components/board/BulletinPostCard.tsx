"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { CommentRow } from "@/components/ui/CommentRow";
import { EmojiReactionPicker } from "@/components/ui/EmojiReactionPicker";
import { formatRelativeTime } from "@/lib/dateUtils";
import {
  addBulletinComment,
  deleteBulletinComment,
  deleteBulletinPost,
  listenBulletinComments,
  toggleReaction,
  updateBulletinPostText,
} from "@/lib/bulletin";
import { notifyCategory } from "@/lib/notifyClient";
import type { BulletinComment, BulletinPost, Person } from "@/lib/types";
import { BULLETIN_MAX_LENGTH } from "./BulletinComposer";

export function BulletinPostCard({
  post,
  people,
  activePersonId,
}: {
  post: BulletinPost;
  people: Person[];
  activePersonId: string;
}) {
  const author = people.find((p) => p.id === post.authorId);
  const isOwn = activePersonId === post.authorId;
  const me = people.find((p) => p.id === activePersonId);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [showPicker, setShowPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<BulletinComment[] | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  // Only subscribe to a post's replies once its thread is actually expanded,
  // so a long feed doesn't hold open a comments listener per post at once.
  useEffect(() => {
    if (!showComments) return;
    return listenBulletinComments(post.id, setComments);
  }, [showComments, post.id]);

  const startEdit = () => {
    setEditText(post.text);
    setEditing(true);
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await updateBulletinPostText(post.id, trimmed);
    setBusy(false);
    setEditing(false);
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    await deleteBulletinPost(post.id);
  };

  // recipientOverride personalizes the copy for the post's author ("your
  // thought") while everyone else with the category enabled gets the
  // generic version -- same split as PhotoCard's photo comments/reactions.
  const notifyAuthor = (body: string, authorBody: string) => {
    void notifyCategory({
      category: "board",
      actorId: activePersonId,
      title: "the board",
      body,
      url: "/board",
      recipientOverride: post.authorId !== activePersonId
        ? { personId: post.authorId, body: authorBody }
        : undefined,
    });
  };

  const reactToPost = async (emoji: string, wasActive: boolean) => {
    await toggleReaction(post.id, emoji, activePersonId, wasActive);
    if (!wasActive) {
      const name = me?.name ?? "someone";
      notifyAuthor(`${name} reacted to a post`, `${name} reacted to your thought`);
    }
  };

  const pickEmoji = async (emoji: string) => {
    setShowPicker(false);
    const reactedAlready = post.reactions[emoji]?.includes(activePersonId) ?? false;
    await reactToPost(emoji, reactedAlready);
  };

  const submitReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await addBulletinComment(post.id, activePersonId, trimmed);
    const name = me?.name ?? "someone";
    notifyAuthor(`${name} replied on the board`, `${name} replied to your thought`);
    setReplyText("");
    setBusy(false);
  };

  const reactionEntries = Object.entries(post.reactions).filter(([, ids]) => ids.length > 0);

  return (
    <Card className="mb-3.5 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {author ? (
            <Avatar src={author.photoUrl} name={author.name} size="sm" />
          ) : (
            <div className="h-6 w-6 shrink-0 rounded-full bg-ink/10" />
          )}
          <span className="font-heading text-sm font-semibold text-ink">
            {author?.name ?? "someone"}
          </span>
          <span className="text-xs text-ink/40">
            · {formatRelativeTime(post.createdAt?.toDate?.() ?? null)}
          </span>
        </div>
        {isOwn && !editing && (
          <div className="flex shrink-0 gap-2.5">
            <button
              onClick={startEdit}
              className="cursor-pointer text-xs font-medium text-ink/40 hover:text-orange"
            >
              edit
            </button>
            <button
              onClick={remove}
              className="cursor-pointer text-xs font-medium text-ink/40 hover:text-orange"
            >
              delete
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-2.5">
          <textarea
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value.slice(0, BULLETIN_MAX_LENGTH))}
            maxLength={BULLETIN_MAX_LENGTH}
            rows={2}
            className="w-full resize-none rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="cursor-pointer rounded-pill border-2 border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/60"
            >
              cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={busy || !editText.trim()}
              className="cursor-pointer rounded-pill border-2 border-ink bg-orange px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-40"
            >
              save
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-[15px] text-ink">{post.text}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {reactionEntries.map(([emoji, ids]) => {
          const active = ids.includes(activePersonId);
          return (
            <button
              key={emoji}
              onClick={() => void reactToPost(emoji, active)}
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
          💬 {post.commentCount}
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
                onDelete={() => void deleteBulletinComment(post.id, comment.id)}
              />
            ))
          )}
          <div className="mt-1.5 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, BULLETIN_MAX_LENGTH))}
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

      {showPicker && <EmojiReactionPicker onPick={pickEmoji} onClose={() => setShowPicker(false)} />}
    </Card>
  );
}
