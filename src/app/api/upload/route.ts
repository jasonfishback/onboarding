import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { put, list, del, get } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface SessionFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
  label: string;
}

// ── Storage backend ──────────────────────────────────────────────────────
// Vercel Blob is the durable store. It MUST be used in production: the old
// in-memory Map could not survive across serverless instances, so uploads done
// on one lambda were invisible to the submit running on another — the carrier's
// documents silently vanished. Blob is shared across all instances.
//
// If BLOB_READ_WRITE_TOKEN isn't configured we fall back to the legacy in-memory
// store so nothing breaks before the Blob store is created — but that path has
// the cross-instance limitation and should not be relied on in production.
const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN;

// Files live transiently: uploaded here, read+deleted by /api/submit. Keyed by
// the carrier's session so submit can collect them all.
const prefixFor = (sessionId: string) => `onboarding-uploads/${sessionId}/`;

// ── Legacy in-memory fallback (only when Blob isn't configured) ──
const fileStore = new Map<string, { files: Map<string, SessionFile>; createdAt: number }>();
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, session] of fileStore.entries()) {
    if (session.createdAt < cutoff) fileStore.delete(id);
  }
}, 30 * 60 * 1000);

/**
 * Collect every file uploaded under a session. Async because the durable
 * (Blob) backend has to list + fetch. Returns undefined when there are none.
 */
export async function getSessionFiles(sessionId: string): Promise<Map<string, SessionFile> | undefined> {
  if (!sessionId) return undefined;

  if (BLOB_ENABLED) {
    try {
      const { blobs } = await list({ prefix: prefixFor(sessionId) });
      if (!blobs.length) return undefined;
      const map = new Map<string, SessionFile>();
      await Promise.all(
        blobs.map(async (b) => {
          // pathname: onboarding-uploads/{sessionId}/{fileKey}/{encodedName}
          const rest = b.pathname.slice(prefixFor(sessionId).length);
          const slash = rest.indexOf("/");
          const fileKey = slash === -1 ? rest : rest.slice(0, slash);
          const name = slash === -1 ? "upload" : decodeURIComponent(rest.slice(slash + 1));
          // Private store: content isn't publicly fetchable — pull it through
          // the SDK with the read-write token (from env).
          const result = await get(b.pathname, { access: "private" });
          if (!result || result.statusCode !== 200 || !result.stream) return;
          const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
          map.set(fileKey, {
            name,
            mimeType: result.blob.contentType || "application/octet-stream",
            buffer,
            label: fileKey,
          });
        })
      );
      return map.size ? map : undefined;
    } catch (err) {
      console.error("[upload] blob list/fetch failed:", err);
      return undefined;
    }
  }

  return fileStore.get(sessionId)?.files;
}

/** Remove all of a session's uploaded files once submit has consumed them. */
export async function deleteSessionFiles(sessionId: string): Promise<void> {
  if (!sessionId) return;
  if (BLOB_ENABLED) {
    try {
      const { blobs } = await list({ prefix: prefixFor(sessionId) });
      if (blobs.length) await del(blobs.map((b) => b.url));
    } catch (err) {
      console.error("[upload] blob cleanup failed (non-critical):", err);
    }
    return;
  }
  fileStore.delete(sessionId);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionId = (formData.get("sessionId") as string) || crypto.randomUUID();
    const fileKey = formData.get("fileKey") as string; // e.g. "w9", "ins", "auth"
    const label = formData.get("label") as string;     // e.g. "W-9 Form"
    const file = formData.get("file") as File;

    if (!file || !fileKey) {
      return NextResponse.json({ error: "Missing file or fileKey" }, { status: 400 });
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (BLOB_ENABLED) {
      // Deterministic path so re-uploading the same slot overwrites cleanly.
      // The path embeds the random session UUID, so it isn't trivially
      // guessable, and submit deletes everything once it's processed.
      const pathname = `${prefixFor(sessionId)}${fileKey}/${encodeURIComponent(file.name || fileKey)}`;
      await put(pathname, buffer, {
        access: "private",
        contentType: file.type || "application/octet-stream",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return NextResponse.json({ success: true, sessionId, fileKey, name: file.name });
    }

    // Fallback: in-memory (pre-Blob-store behavior)
    if (!fileStore.has(sessionId)) {
      fileStore.set(sessionId, { files: new Map(), createdAt: Date.now() });
    }
    fileStore.get(sessionId)!.files.set(fileKey, {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      label: label || fileKey,
    });
    return NextResponse.json({ success: true, sessionId, fileKey, name: file.name });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
