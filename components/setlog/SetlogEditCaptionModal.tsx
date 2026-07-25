"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { updateSetlogClipCaption } from "@/lib/setlog";
import type { SetlogClip } from "@/lib/types";

const CAPTION_MAX_LENGTH = 140;

export function SetlogEditCaptionModal({
  clip,
  onClose,
}: {
  clip: SetlogClip;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(clip.caption);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await updateSetlogClipCaption(clip.id, caption);
    setSaving(false);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-3 text-center font-heading text-base font-semibold text-ink">
        edit caption
      </p>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX_LENGTH))}
        placeholder="caption (optional)"
        className="mb-4 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
        autoFocus
      />
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving ? "saving..." : "save"}
        </Button>
      </div>
    </Modal>
  );
}
