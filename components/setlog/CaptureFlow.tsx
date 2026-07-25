"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { notifyCategory } from "@/lib/notifyClient";
import { submitSetlogClip } from "@/lib/setlog";
import { formatHourLabel } from "@/lib/setlogTime";

const CLIP_DURATION_MS = 4000;
const MAX_RETAKES = 1;
const CAPTION_MAX_LENGTH = 140;

// Safari reports the bare "video/mp4" as supported but often reports the
// codec-qualified variant ("video/mp4;codecs=h264,aac") as NOT supported,
// which used to make pickMimeType() skip straight past both mp4 options and
// fall through to "" -- letting Safari record with an unrequested/undefined
// format. Bare "video/mp4" has to come first so Safari actually gets an
// explicit, valid mimeType instead of an implicit default.
const MIME_CANDIDATES = [
  "video/mp4",
  "video/mp4;codecs=h264,aac",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

type Phase = "camera" | "recording" | "preview" | "caption" | "uploading" | "error";

/**
 * Full capture experience for one Setlog slot: live camera preview with a
 * front/back toggle, a fixed 4-second recording, one optional retake, an
 * optional caption prompt, then upload. No filters/trimming/editing
 * anywhere in this flow -- matches the raw/unedited spirit the feature is
 * going for.
 */
export function CaptureFlow({
  personId,
  personName,
  slotId,
  slotHour,
  remainingLabel,
  isWindowOpen,
  onDone,
}: {
  personId: string;
  personName: string;
  slotId: string;
  slotHour: number;
  remainingLabel: string;
  isWindowOpen: boolean;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [phase, setPhase] = useState<Phase>("camera");
  const [error, setError] = useState<string | null>(null);
  const [retakes, setRetakes] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [caption, setCaption] = useState("");
  const [countIn, setCountIn] = useState(4);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) {
          setError("couldn't access the camera/mic — check your browser permissions.");
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [phase, facingMode]);

  // Close automatically if the slot's window runs out mid-flow -- no late
  // submissions, so there's nothing useful left for the person to do here.
  useEffect(() => {
    if (!isWindowOpen && phase !== "uploading") onDone();
  }, [isWindowOpen, phase, onDone]);

  useEffect(() => {
    return () => {
      stopStream();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup-only unmount effect
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      // recorder.mimeType reflects whatever format the browser *actually*
      // used -- on Safari/iOS none of MIME_CANDIDATES' codec-qualified
      // strings are ever reported as supported (Safari is picky about the
      // exact codec string), so pickMimeType() returns "" and Safari falls
      // back to its own default recording format. Labeling the resulting
      // Blob with a hardcoded "video/webm" in that case was the bug --
      // Safari's actual output is real, playable video, just not webm, and
      // a mislabeled Blob fails to decode anywhere, including its own
      // preview here.
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "video/webm",
      });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      stopStream();
      setPhase("preview");
    };

    recorderRef.current = recorder;
    recorder.start();
    setPhase("recording");
    setCountIn(4);

    const tick = setInterval(() => setCountIn((c) => Math.max(0, c - 1)), 1000);
    stopTimerRef.current = setTimeout(() => {
      clearInterval(tick);
      recorder.stop();
    }, CLIP_DURATION_MS);
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setRetakes((r) => r + 1);
    setPhase("camera");
  };

  const post = async () => {
    if (!recordedBlob) return;
    setPhase("uploading");
    try {
      await submitSetlogClip(recordedBlob, caption, personId, slotId);
      void notifyCategory({
        category: "setlog",
        actorId: personId,
        title: "setlog",
        body: `${personName} posted their ${formatHourLabel(slotHour)} Setlog`,
        url: "/setlog",
      });
      onDone();
    } catch {
      setError("upload failed — check your connection and try again.");
      setPhase("caption");
    }
  };

  return (
    <Modal onClose={onDone}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-heading text-lg font-semibold text-ink">capture your moment</p>
        <span className="rounded-pill border-2 border-ink bg-orange px-2.5 py-1 font-heading text-xs font-semibold text-card">
          {remainingLabel}
        </span>
      </div>

      {phase === "error" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-ink/60">{error}</p>
          <Button variant="ghost" onClick={onDone}>
            close
          </Button>
        </div>
      )}

      {(phase === "camera" || phase === "recording") && (
        <div>
          <div className="relative mb-3 aspect-[9/16] w-full overflow-hidden rounded-card-sm border-2 border-ink bg-ink">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
            />
            {phase === "recording" && (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-pill bg-ink/70 px-2.5 py-1 text-xs font-semibold text-card">
                <span className="h-2 w-2 animate-pulse rounded-full bg-orange" />
                {countIn}s
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4">
            {phase === "camera" && (
              <button
                onClick={() => setFacingMode((f) => (f === "user" ? "environment" : "user"))}
                className="cursor-pointer rounded-pill border-2 border-ink bg-card px-3.5 py-2.5 text-sm font-medium text-ink"
              >
                flip camera
              </button>
            )}
            <Button onClick={startRecording} disabled={phase === "recording"}>
              {phase === "recording" ? "recording..." : "record 4s clip"}
            </Button>
          </div>
        </div>
      )}

      {phase === "preview" && previewUrl && (
        <div>
          <video
            src={previewUrl}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="mb-3 aspect-[9/16] w-full rounded-card-sm border-2 border-ink object-cover"
          />
          <div className="flex gap-3">
            {retakes < MAX_RETAKES && (
              <Button variant="ghost" className="flex-1" onClick={retake}>
                retake
              </Button>
            )}
            <Button className="flex-1" onClick={() => setPhase("caption")}>
              use this
            </Button>
          </div>
        </div>
      )}

      {phase === "caption" && previewUrl && (
        <div>
          <video
            src={previewUrl}
            autoPlay
            muted
            loop
            playsInline
            className="mb-3 aspect-[9/16] w-full rounded-card-sm border-2 border-ink object-cover"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX_LENGTH))}
            placeholder="caption (optional)"
            className="mb-3 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
          />
          {error && <p className="mb-2 text-center text-sm text-orange-dark">{error}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setPhase("preview")}>
              back
            </Button>
            <Button className="flex-1" onClick={post}>
              post
            </Button>
          </div>
        </div>
      )}

      {phase === "uploading" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-ink/60">uploading your clip...</p>
        </div>
      )}
    </Modal>
  );
}
