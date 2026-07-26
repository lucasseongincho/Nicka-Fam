"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Mascot } from "@/components/ui/Mascot";
import { mascotColorForPerson, toPlayableClipUrl } from "@/lib/setlog";
import { formatHourLabel } from "@/lib/setlogTime";
import type { Person, SetlogClip } from "@/lib/types";

/**
 * One person's box for one hourly slot. Tapping a filled box (yours or
 * anyone else's) opens that clip's comments; tapping your own still-empty
 * box only records if this is the currently open slot and you haven't
 * posted yet -- everyone else's empty boxes, and your own once the window's
 * closed, aren't tappable at all.
 */
export function SetlogClipBox({
  person,
  clip,
  isSelf,
  canRecord,
  missed,
  isEditable,
  slotHour,
  onRecord,
  onOpenComments,
  onEditCaption,
}: {
  person: Person;
  clip: SetlogClip | null;
  isSelf: boolean;
  canRecord: boolean;
  missed: boolean;
  isEditable: boolean;
  slotHour: number;
  onRecord: () => void;
  onOpenComments: (clip: SetlogClip) => void;
  onEditCaption: (clip: SetlogClip) => void;
}) {
  const hourLabel = formatHourLabel(slotHour);
  const tappable = !!clip || canRecord;

  return (
    <div
      onClick={() => {
        if (clip) onOpenComments(clip);
        else if (canRecord) onRecord();
      }}
      className={`relative flex aspect-[3/4] flex-col overflow-hidden rounded-card border-2 border-ink bg-card ${
        tappable ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <Avatar src={person.photoUrl} name={person.name} size="sm" />
        <span className="text-xs font-medium text-ink/75">{person.name}</span>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-cream">
        {clip ? (
          <>
            <video
              src={toPlayableClipUrl(clip.videoUrl)}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/30 to-transparent px-2.5 pb-2 pt-8 text-center">
              <p className="font-heading text-sm font-semibold text-card">{hourLabel}</p>
              {clip.caption && (
                <p className="mt-0.5 line-clamp-2 text-xs text-card/90">{clip.caption}</p>
              )}
            </div>
            {isSelf && isEditable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCaption(clip);
                }}
                className="absolute bottom-1.5 right-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-ink/50 text-xs text-card"
                aria-label="edit caption"
              >
                •••
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Mascot size={44} color={mascotColorForPerson(person.id)} mouth />
            <span className="font-heading text-xl font-bold text-ink/10">{hourLabel}</span>
            {missed && (
              <span className="rounded-chip bg-ink/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/35">
                missed
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
