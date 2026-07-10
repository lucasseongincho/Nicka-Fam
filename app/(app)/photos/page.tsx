"use client";

import { useEffect, useMemo, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { listenPhotos } from "@/lib/photos";
import { formatRelativeTime } from "@/lib/dateUtils";
import type { Photo } from "@/lib/types";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Mascot } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";
import { UploadPhotoModal } from "@/components/photos/UploadPhotoModal";

export default function PhotosPage() {
  const { people } = usePeople();
  const [view, setView] = useState<"feed" | "grid">("feed");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => listenPhotos(setPhotos), []);

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p]));
    return (id: string) => map.get(id);
  }, [people]);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center px-2.5 pt-10 text-center">
        <div className="mb-4.5">
          <Mascot size={84} color="teal" mouth />
        </div>
        <p className="mb-1.5 font-heading text-xl font-semibold text-ink">
          no photos yet
        </p>
        <p className="mb-4.5 max-w-[230px] text-sm leading-relaxed text-ink/55">
          the pixels are lonely. someone panic-post something.
        </p>
        <Button onClick={() => setShowUpload(true)}>add the first one</Button>
        {showUpload && (
          <UploadPhotoModal onClose={() => setShowUpload(false)} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <SegmentedToggle
          value={view}
          onChange={setView}
          options={[
            { value: "feed", label: "feed" },
            { value: "grid", label: "grid" },
          ]}
        />
        <button
          onClick={() => setShowUpload(true)}
          className="cursor-pointer rounded-pill border-2 border-ink bg-orange px-3.5 py-2 font-heading text-sm font-semibold text-card shadow-button"
        >
          + add
        </button>
      </div>

      {view === "feed" &&
        photos.map((photo) => {
          const person = nameOf(photo.uploadedBy);
          return (
            <div
              key={photo.id}
              className="mb-3.5 overflow-hidden rounded-card border-2 border-ink bg-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || "shared photo"}
                className="block h-[220px] w-full object-cover"
              />
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 font-body text-[13px] text-ink">
                  {person && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.photoUrl}
                      alt={person.name}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  )}
                  <span className="font-medium">{person?.name ?? "someone"}</span>
                  <span className="text-ink/40">
                    · {formatRelativeTime(photo.createdAt?.toDate?.() ?? null)}
                  </span>
                </div>
                {photo.caption && (
                  <p className="mt-1 text-sm text-ink/75">{photo.caption}</p>
                )}
              </div>
            </div>
          );
        })}

      {view === "grid" && (
        <div className="grid grid-cols-3 gap-1.5 pb-14">
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.caption || "shared photo"}
              className="aspect-square w-full rounded-lg border-2 border-ink object-cover"
            />
          ))}
        </div>
      )}

      {showUpload && <UploadPhotoModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
