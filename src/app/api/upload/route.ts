import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// In-memory store: sessionId -> map of fileKey -> { name, mimeType, buffer, label }
// Files are kept for 2 hours then GC'd
const fileStore = new Map<string, {
  files: Map<string, { name: string; mimeType: string; buffer: Buffer; label: string }>;
  createdAt: number;
}>();

// Garbage collect old sessions every 30 min
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, session] of fileStore.entries()) {
    if (session.createdAt < cutoff) fileStore.delete(id);
  }
}, 30 * 60 * 1000);

export function getSessionFiles(sessionId: string) {
  return fileStore.get(sessionId)?.files;
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

    // Initialize session if needed
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
