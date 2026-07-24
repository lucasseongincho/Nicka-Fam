"use client";

import type { VoteDesign } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function DesignLightbox({
  design,
  isMyVote,
  canVote,
  canRemove,
  onVote,
  onRemove,
  onClose,
}: {
  design: VoteDesign;
  isMyVote: boolean;
  canVote: boolean;
  canRemove: boolean;
  onVote: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={design.imageUrl}
        alt="submitted design"
        className="mb-4 max-h-[55vh] w-full rounded-card-sm border-2 border-ink bg-paper object-contain"
      />

      <div className="mb-4 flex items-center justify-between">
        <span className="font-heading text-base font-semibold text-ink">
          ❤ {design.voteCount} {design.voteCount === 1 ? "vote" : "votes"}
        </span>
        {isMyVote && (
          <span className="rounded-chip border-2 border-ink bg-orange/15 px-2.5 py-1 text-xs font-semibold text-orange-dark">
            ✓ your pick
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {canVote && !isMyVote && <Button onClick={onVote}>vote for this design</Button>}
        {canRemove && (
          <Button variant="ghost" className="text-orange-dark" onClick={onRemove}>
            remove my design
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          close
        </Button>
      </div>
    </Modal>
  );
}
