"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { listenSetlogClipsForSlot, listenSetlogCommentsForSlot, toPlayableClipUrl } from "@/lib/setlog";
import { formatHourLabel } from "@/lib/setlogTime";
import type { Person, SetlogClip, SetlogComment } from "@/lib/types";

type FeedItem =
  | { kind: "clip"; at: number; clip: SetlogClip }
  | { kind: "comment"; at: number; comment: SetlogComment };

/**
 * Read-only merged feed: every clip and every comment across all 6 people's
 * boxes for one slot, in one chronological thread -- so you can follow the
 * whole hour's conversation without checking each box individually. Each
 * comment is tagged with whose clip it was left on (not just who wrote it),
 * since a single thread otherwise loses that context. Posting still happens
 * from the per-clip view (SetlogCommentSheet), not here.
 */
export function SetlogSlotChatroom({
  slotId,
  slotHour,
  people,
  activePersonId,
  onClose,
}: {
  slotId: string;
  slotHour: number;
  people: Person[];
  activePersonId: string;
  onClose: () => void;
}) {
  const [clips, setClips] = useState<SetlogClip[]>([]);
  const [comments, setComments] = useState<SetlogComment[]>([]);

  useEffect(() => listenSetlogClipsForSlot(slotId, setClips), [slotId]);
  useEffect(() => listenSetlogCommentsForSlot(slotId, setComments), [slotId]);

  const clipOwnerById = useMemo(() => {
    const map = new Map<string, string>();
    for (const clip of clips) map.set(clip.id, clip.personId);
    return map;
  }, [clips]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...clips.map((clip) => ({
        kind: "clip" as const,
        at: clip.createdAt?.toMillis?.() ?? 0,
        clip,
      })),
      ...comments.map((comment) => ({
        kind: "comment" as const,
        at: comment.createdAt?.toMillis?.() ?? 0,
        comment,
      })),
    ];
    return items.sort((a, b) => a.at - b.at);
  }, [clips, comments]);

  const nameOf = (id: string | undefined) => people.find((p) => p.id === id)?.name ?? "someone";
  const photoOf = (id: string) => people.find((p) => p.id === id)?.photoUrl ?? "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
        <button onClick={onClose} className="cursor-pointer font-body text-sm font-medium text-orange">
          ‹ back
        </button>
        <p className="font-heading text-sm font-semibold text-ink">
          {formatHourLabel(slotHour)} setlog chat
        </p>
        <span className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {feed.length === 0 ? (
          <p className="pt-10 text-center text-sm text-ink/40">nothing here yet</p>
        ) : (
          feed.map((item) => {
            if (item.kind === "clip") {
              const isOwn = item.clip.personId === activePersonId;
              return (
                <div
                  key={`clip-${item.clip.id}`}
                  className={`mb-3 flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                >
                  <p className="mb-1 text-[11px] font-semibold text-ink/50">
                    {nameOf(item.clip.personId)}
                  </p>
                  <video
                    src={toPlayableClipUrl(item.clip.videoUrl)}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="aspect-[9/16] w-32 rounded-card-sm border-2 border-ink object-cover"
                  />
                  {item.clip.caption && (
                    <p className="mt-1 max-w-[150px] text-xs text-ink/60">{item.clip.caption}</p>
                  )}
                </div>
              );
            }

            const isOwn = item.comment.personId === activePersonId;
            const ownerName = nameOf(clipOwnerById.get(item.comment.clipId));
            return (
              <div
                key={`comment-${item.comment.id}`}
                className={`mb-2.5 flex items-end gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {!isOwn && (
                  <Avatar
                    src={photoOf(item.comment.personId)}
                    name={nameOf(item.comment.personId)}
                    size="sm"
                  />
                )}
                <div
                  className={`max-w-[75%] rounded-card-sm px-3 py-1.5 ${
                    isOwn ? "bg-orange text-card" : "border-2 border-ink/10 bg-card text-ink"
                  }`}
                >
                  <p className={`mb-0.5 text-[11px] font-semibold ${isOwn ? "text-card/70" : "text-ink/50"}`}>
                    {nameOf(item.comment.personId)} · on {ownerName}&apos;s clip
                  </p>
                  <p className="text-[13px]">{item.comment.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
