"use client";

import { useEffect, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import {
  castVote,
  deleteVoteDesign,
  listenMyVote,
  listenVoteDesigns,
  listenVoteSession,
  setVotingOpen,
} from "@/lib/votes";
import type { DesignVote, VoteDesign, VoteSession } from "@/lib/types";
import { Mascot } from "@/components/ui/Mascot";
import { Button } from "@/components/ui/Button";
import { DesignCard } from "@/components/vote/DesignCard";
import { UploadDesignModal } from "@/components/vote/UploadDesignModal";

const UPLOADS_STORAGE_KEY = "nickafam_vote_uploads";

// Designs this device has uploaded, so the uploader can see a "remove" button
// on their own submissions -- this is the only place uploaderId is ever
// compared against anything, and it never touches Firestore (that field has
// no client read path at all, see lib/votes.ts).
function readMyUploads(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(UPLOADS_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function rememberUpload(designId: string, uploaderId: string) {
  const uploads = readMyUploads();
  uploads[designId] = uploaderId;
  localStorage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
}

export default function VotePage() {
  const { activePersonId } = usePeople();
  const [designs, setDesigns] = useState<VoteDesign[]>([]);
  const [session, setSession] = useState<VoteSession | null>(null);
  const [myVote, setMyVote] = useState<DesignVote | null>(null);
  const [myUploads, setMyUploads] = useState<Record<string, string>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side, same one-time-read pattern as PersonContext's hydration read.
    setMyUploads(readMyUploads());
  }, []);
  useEffect(() => listenVoteSession(setSession), []);
  useEffect(() => {
    return listenVoteDesigns((d) => {
      setDesigns(d);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!activePersonId) return;
    return listenMyVote(activePersonId, setMyVote);
  }, [activePersonId]);

  if (!loaded || !activePersonId) return null;

  const votingOpen = session?.open ?? true;

  const vote = async (design: VoteDesign) => {
    if (!votingOpen) return;
    await castVote(design.id, activePersonId, myVote?.designId ?? null);
  };

  const remove = async (design: VoteDesign) => {
    await deleteVoteDesign(design.id);
    const uploads = { ...myUploads };
    delete uploads[design.id];
    localStorage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
    setMyUploads(uploads);
  };

  if (designs.length === 0) {
    return (
      <div className="flex flex-col items-center px-2.5 pt-10 text-center">
        <div className="mb-4.5">
          <Mascot size={84} color="orange" mouth />
        </div>
        <p className="mb-1.5 font-heading text-xl font-semibold text-ink">
          no designs yet
        </p>
        <p className="mb-4.5 max-w-[230px] text-sm leading-relaxed text-ink/55">
          someone&apos;s gotta submit a t-shirt design first.
        </p>
        {votingOpen && (
          <Button onClick={() => setShowUpload(true)}>submit a design</Button>
        )}
        {showUpload && (
          <UploadDesignModal
            uploaderId={activePersonId}
            onClose={() => setShowUpload(false)}
            onUploaded={(designId) => {
              rememberUpload(designId, activePersonId);
              setMyUploads(readMyUploads());
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <span
          className={`rounded-chip border-2 border-ink px-3 py-1.5 text-xs font-semibold ${
            votingOpen ? "bg-orange/15 text-orange-dark" : "bg-ink/5 text-ink/50"
          }`}
        >
          {votingOpen ? "voting open" : "voting closed"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void setVotingOpen(!votingOpen)}
            className="cursor-pointer rounded-pill border-2 border-ink bg-transparent px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/5"
          >
            {votingOpen ? "close voting" : "reopen voting"}
          </button>
          {votingOpen && (
            <button
              onClick={() => setShowUpload(true)}
              className="cursor-pointer rounded-pill border-2 border-ink bg-orange px-3.5 py-1.5 font-heading text-xs font-semibold text-card shadow-button"
            >
              + submit
            </button>
          )}
        </div>
      </div>

      <p className="mb-3.5 text-sm text-ink/55">
        {votingOpen
          ? myVote
            ? "tap another design to change your vote."
            : "tap a design to cast your vote."
          : "voting's closed — here's how it landed."}
      </p>

      <div className="grid grid-cols-2 gap-3 pb-14">
        {designs.map((design) => (
          <DesignCard
            key={design.id}
            design={design}
            isMyVote={myVote?.designId === design.id}
            canVote={votingOpen}
            canRemove={
              votingOpen &&
              design.voteCount === 0 &&
              myUploads[design.id] === activePersonId
            }
            onVote={() => void vote(design)}
            onRemove={() => void remove(design)}
          />
        ))}
      </div>

      {showUpload && (
        <UploadDesignModal
          uploaderId={activePersonId}
          onClose={() => setShowUpload(false)}
          onUploaded={(designId) => {
            rememberUpload(designId, activePersonId);
            setMyUploads(readMyUploads());
          }}
        />
      )}
    </div>
  );
}
