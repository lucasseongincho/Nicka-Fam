"use client";

import { useEffect, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { listenPhotos } from "@/lib/photos";
import type { Photo } from "@/lib/types";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Mascot } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";
import { PhotoCard } from "@/components/photos/PhotoCard";
import { UploadPhotoModal } from "@/components/photos/UploadPhotoModal";
import { EditPhotoModal } from "@/components/photos/EditPhotoModal";

export default function PhotosPage() {
  const { people, activePersonId } = usePeople();
  const [view, setView] = useState<"feed" | "grid">("feed");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);

  useEffect(() => listenPhotos(setPhotos), []);

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

      {view === "feed" && activePersonId &&
        photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            people={people}
            activePersonId={activePersonId}
            onEdit={() => setEditingPhoto(photo)}
          />
        ))}

      {view === "grid" && (
        <div className="grid grid-cols-3 gap-1.5 pb-14">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setEditingPhoto(photo)}
              className="cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || "shared photo"}
                className="aspect-square w-full rounded-lg border-2 border-ink object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {showUpload && <UploadPhotoModal onClose={() => setShowUpload(false)} />}
      {editingPhoto && (
        <EditPhotoModal
          photo={editingPhoto}
          onClose={() => setEditingPhoto(null)}
        />
      )}
    </div>
  );
}
