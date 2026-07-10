"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import { deletePhoto, updatePhotoCaption } from "@/lib/photos";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function EditPhotoModal({
  photo,
  onClose,
}: {
  photo: Photo;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    await updatePhotoCaption(photo.id, caption.trim());
    onClose();
  };

  const remove = async () => {
    setSubmitting(true);
    await deletePhoto(photo.id);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        edit photo
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || "shared photo"}
        className="mb-3 h-48 w-full rounded-card-sm border-2 border-ink object-cover"
      />
      <input
        autoFocus
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="caption (optional)"
        className="mb-5 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />
      <div className="flex gap-3">
        <Button
          variant="ghost"
          className="flex-1 text-orange-dark"
          disabled={submitting}
          onClick={remove}
        >
          delete
        </Button>
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button className="flex-1" disabled={submitting} onClick={submit}>
          save
        </Button>
      </div>
    </Modal>
  );
}
