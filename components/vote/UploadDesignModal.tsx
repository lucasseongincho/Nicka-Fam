"use client";

import { useState } from "react";
import { uploadVoteDesign } from "@/lib/votes";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function UploadDesignModal({
  uploaderId,
  onClose,
  onUploaded,
}: {
  uploaderId: string;
  onClose: () => void;
  onUploaded: (designId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (f: File | null) => {
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    const designId = await uploadVoteDesign(file, uploaderId);
    onUploaded(designId);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        submit a design
      </p>

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="preview"
          className="mb-5 h-48 w-full rounded-card-sm border-2 border-ink object-cover"
        />
      ) : (
        <label className="mb-5 flex h-48 w-full cursor-pointer items-center justify-center rounded-card-sm border-2 border-dashed border-ink/35 text-sm text-ink/50">
          tap to choose a design image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button className="flex-1" disabled={!file || uploading} onClick={submit}>
          {uploading ? "uploading..." : "submit"}
        </Button>
      </div>
    </Modal>
  );
}
