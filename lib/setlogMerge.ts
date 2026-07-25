import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

// Server-only, Node runtime only (child_process + /tmp). Deliberately uses
// a *native* ffmpeg binary (bundled via ffmpeg-static, not the browser/WASM
// build) run as a child process -- see app/api/setlog/tick/route.ts and
// next.config.ts's outputFileTracingIncludes, which is what gets this
// binary actually shipped into the Vercel function's bundle.

const execFileAsync = promisify(execFile);

const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1280;
const OUTPUT_FPS = 30;
/** Leaves headroom under the Vercel function's own maxDuration for download + Cloudinary upload. */
const FFMPEG_TIMEOUT_MS = 45_000;

async function downloadClip(url: string, destDir: string, index: number): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to download clip ${url}: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const dest = path.join(destDir, `in-${index}.${ext}`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

async function hasAudioStream(filePath: string): Promise<boolean> {
  const { stdout } = await execFileAsync(ffprobeStatic.path, [
    "-v",
    "error",
    "-select_streams",
    "a",
    "-show_entries",
    "stream=index",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  return stdout.trim().length > 0;
}

/**
 * Concatenates clips (already in final order) into one mp4, hard-cutting
 * between them with no transition -- matches the "raw/unedited" spirit of
 * the feature. Each input is decoded and re-encoded (scale/pad/fps/format
 * normalized) rather than stream-copied, since clips come from different
 * phones/browsers with different resolutions and codecs (portrait vs.
 * landscape, H.264 vs. VP9) and the concat *demuxer* requires identical
 * params across segments -- the concat *filter* used here doesn't.
 */
async function concatClips(inputPaths: string[], outputPath: string): Promise<void> {
  const hasAudio = await Promise.all(inputPaths.map(hasAudioStream));

  const inputArgs: string[] = [];
  inputPaths.forEach((p) => inputArgs.push("-i", p));

  // Clips with no audio track (shouldn't normally happen, capture always
  // requests a mic -- but a device without one would produce one) get a
  // matching-length silent track appended as an extra lavfi input, so
  // every segment still has an [a]/[v] pair for the concat filter.
  const silentInputIndexOf = new Map<number, number>();
  hasAudio.forEach((ok, i) => {
    if (!ok) {
      const inputIndex = inputPaths.length + silentInputIndexOf.size;
      silentInputIndexOf.set(i, inputIndex);
      inputArgs.push("-f", "lavfi", "-t", "4", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    }
  });

  const videoFilters = inputPaths.map(
    (_, i) =>
      `[${i}:v]scale=w=${OUTPUT_WIDTH}:h=${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,` +
      `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${OUTPUT_FPS},format=yuv420p[v${i}]`,
  );
  const audioFilters = inputPaths.map((_, i) => {
    const source = silentInputIndexOf.has(i) ? `${silentInputIndexOf.get(i)}:a` : `${i}:a`;
    return `[${source}]aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`;
  });
  const concatInputs = inputPaths.map((_, i) => `[v${i}][a${i}]`).join("");
  const filterComplex = [
    ...videoFilters,
    ...audioFilters,
    `${concatInputs}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`,
  ].join(";");

  if (!ffmpegPath) throw new Error("ffmpeg-static did not resolve a binary for this platform");

  await execFileAsync(
    ffmpegPath,
    [
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
      "-map",
      "[outa]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ],
    { timeout: FFMPEG_TIMEOUT_MS },
  );
}

async function uploadMergedVideo(filePath: string): Promise<{ url: string; publicId: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME/UPLOAD_PRESET aren't set -- can't upload the merged video");
  }

  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "video/mp4" }), "setlog-merged.mp4");
  form.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Cloudinary merged-video upload failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

/**
 * Downloads clipUrls (already in final slot/submission order), concatenates
 * them natively via ffmpeg, uploads the result to Cloudinary, and cleans up
 * every temp file regardless of outcome. Raw clips themselves are left
 * alone -- this only ever reads them by URL.
 */
export async function mergeAndUploadSetlogClips(clipUrls: string[]): Promise<{ url: string; publicId: string }> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "setlog-"));
  try {
    const inputPaths = await Promise.all(clipUrls.map((url, i) => downloadClip(url, workDir, i)));
    const outputPath = path.join(workDir, "merged.mp4");
    await concatClips(inputPaths, outputPath);
    return await uploadMergedVideo(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
