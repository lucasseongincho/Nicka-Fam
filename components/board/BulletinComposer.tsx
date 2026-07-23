"use client";

import { useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { addBulletinPost } from "@/lib/bulletin";
import { notifyCategory } from "@/lib/notifyClient";

export const BULLETIN_MAX_LENGTH = 200;

export function BulletinComposer({ authorId }: { authorId: string }) {
  const { activePerson } = usePeople();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    await addBulletinPost(authorId, trimmed);
    void notifyCategory({
      category: "board",
      actorId: authorId,
      title: "the board",
      body: `${activePerson?.name ?? "someone"} posted on the board`,
      url: "/board",
    });
    setText("");
    setSubmitting(false);
  };

  return (
    <Card className="mb-3.5 px-3.5 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, BULLETIN_MAX_LENGTH))}
        maxLength={BULLETIN_MAX_LENGTH}
        rows={2}
        placeholder="what's on your mind?"
        className="w-full resize-none rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-ink/40">
          {text.length}/{BULLETIN_MAX_LENGTH}
        </span>
        <Button onClick={submit} disabled={!text.trim() || submitting}>
          {submitting ? "posting..." : "post"}
        </Button>
      </div>
    </Card>
  );
}
