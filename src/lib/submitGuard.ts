import { put, list, del } from "@vercel/blob";

// ── Submit de-duplication ────────────────────────────────────────────────
// The browser now RETRIES /api/submit when the request dies on the network
// (a phone dropping signal as the carrier taps Submit). A retry is only safe
// if a request that DID reach us, but whose response was lost, isn't processed
// twice — that would send dispatch a second packet with no documents, because
// the first run already consumed and deleted the uploads.
//
// Each submission carries a client-generated submissionId. We keep two tiny
// marker blobs per id:
//   onboarding-submitted/{id}/claim  — written when processing starts
//   onboarding-submitted/{id}/done   — written when the packet went out
//
// No Blob store configured → the guard is a no-op and every request proceeds,
// exactly as before.

const BLOB_ENABLED = !!process.env.BLOB_READ_WRITE_TOKEN;
const prefixFor = (id: string) => `onboarding-submitted/${id}/`;
// Longer than the route's maxDuration (60s): a claim older than this with no
// "done" marker means that run died, so a retry may take the submission over.
const STALE_CLAIM_MS = 90_000;

export type ClaimResult = "proceed" | "in_progress" | "done";

const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(id);

async function writeMarker(id: string, name: "claim" | "done", allowOverwrite: boolean) {
  await put(`${prefixFor(id)}${name}`, new Date().toISOString(), {
    access: "private",
    contentType: "text/plain",
    addRandomSuffix: false,
    allowOverwrite,
  });
}

/** Decide whether this request should process the submission. Never throws. */
export async function claimSubmission(id: unknown): Promise<ClaimResult> {
  if (!BLOB_ENABLED || !validId(id)) return "proceed";
  try {
    const { blobs } = await list({ prefix: prefixFor(id) });
    if (blobs.some((b) => b.pathname.endsWith("/done"))) return "done";
    const claim = blobs.find((b) => b.pathname.endsWith("/claim"));
    if (claim) {
      const age = Date.now() - new Date(claim.uploadedAt).getTime();
      if (age < STALE_CLAIM_MS) return "in_progress";
      await writeMarker(id, "claim", true); // stale → take it over
      return "proceed";
    }
    try {
      await writeMarker(id, "claim", false);
      return "proceed";
    } catch {
      // Lost a race: another request claimed it between our list and put.
      return "in_progress";
    }
  } catch (err) {
    // Storage hiccup must never block a real submission.
    console.error("[submit] submission guard unavailable, proceeding:", String(err));
    return "proceed";
  }
}

/** Record that the packet was delivered, so a late retry is answered as success. */
export async function markSubmissionDone(id: unknown): Promise<void> {
  if (!BLOB_ENABLED || !validId(id)) return;
  try {
    await writeMarker(id, "done", true);
  } catch (err) {
    console.error("[submit] could not write done marker (non-critical):", String(err));
  }
}

/** Drop the claim after a failed run so the carrier can try again immediately. */
export async function releaseSubmission(id: unknown): Promise<void> {
  if (!BLOB_ENABLED || !validId(id)) return;
  try {
    const { blobs } = await list({ prefix: prefixFor(id) });
    if (blobs.length) await del(blobs.map((b) => b.url));
  } catch (err) {
    console.error("[submit] could not release claim (non-critical):", String(err));
  }
}
