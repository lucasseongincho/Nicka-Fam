"use client";

import { useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { uploadPhoto } from "@/lib/photos";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function UploadPhotoModal({ onClose }: { onClose: () => void }) {
  const { activePersonId } = usePeople();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFile = (f: File | null) => {
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!file || !activePersonId) return;
    setUploading(true);
    await uploadPhoto(file, caption.trim(), activePersonId);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        add a photo
      </p>

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="preview"
          className="mb-3 h-48 w-full rounded-card-sm border-2 border-ink object-cover"
        />
      ) : (
        <label className="mb-3 flex h-48 w-full cursor-pointer items-center justify-center rounded-card-sm border-2 border-dashed border-ink/35 text-sm text-ink/50">
          tap to choose a photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="caption (optional)"
        className="mb-5 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />

      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!file || uploading}
          onClick={submit}
        >
          {uploading ? "posting..." : "post"}
        </Button>
      </div>
    </Modal>
  );
}
