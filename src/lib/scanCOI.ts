// COI (Certificate of Insurance) scanner — extracts producer/agent email from uploaded PDF.
//
// Approach: Use pdf-parse to extract text from page 1, then identify candidate emails
// using a position-aware heuristic that prioritizes emails appearing near "PRODUCER" label
// (the top-left section on standard ACORD 25 forms).
//
// We intentionally do NOT do OCR — scanned PDFs without a text layer will return null,
// at which point the dispatch email falls back to manual entry. Adding OCR would bloat the
// serverless function by 50MB+ and add 10-15s latency per file, which isn't worth it for
// the 30-40% of COIs that are scanned.

interface PdfParseModule {
  (buf: Buffer): Promise<{ text: string; numpages: number; info?: Record<string, unknown> }>;
}

export interface CoiScanResult {
  // Best-guess agent/producer email address, or null if none could be identified
  producerEmail: string | null;
  // Other emails found in the document (insured, certificate holder, etc.) — useful for review
  otherEmails: string[];
  // Whether we successfully extracted text from the PDF (false = scanned image PDF)
  textExtracted: boolean;
  // Any expiration dates we found, e.g. "2025-08-15"
  expirationDates: string[];
}

// Words that strongly suggest the email NEAR them is a producer/agent email
const PRODUCER_HINTS = ["producer", "agency", "broker", "insurance services", "insurance group"];
// Words that suggest the email belongs to insured/holder, NOT the producer
const NEGATIVE_HINTS = ["insured", "holder", "underwriter", "carrier", "company"];

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export async function scanCOI(pdfBuffer: Buffer): Promise<CoiScanResult> {
  const result: CoiScanResult = {
    producerEmail: null,
    otherEmails: [],
    textExtracted: false,
    expirationDates: [],
  };

  let text = "";
  try {
    // pdf-parse default export is a function
    const mod = await import("pdf-parse");
    const pdfParse = (mod.default ?? mod) as PdfParseModule;
    const parsed = await pdfParse(pdfBuffer);
    text = parsed.text || "";
  } catch (err) {
    console.error("[scanCOI] pdf-parse failed:", String(err));
    return result;
  }

  if (!text || text.trim().length < 50) {
    // Likely a scanned/image-only PDF — no text layer extractable without OCR
    return result;
  }

  result.textExtracted = true;

  // Find all email-like strings
  const allEmails = Array.from(new Set((text.match(EMAIL_REGEX) || []).map(e => e.toLowerCase())));
  if (allEmails.length === 0) return result;

  // Score each email by proximity to producer keywords
  // (lower index in text + nearby producer hint = higher score)
  const lowerText = text.toLowerCase();
  const scored = allEmails.map(email => {
    const idx = lowerText.indexOf(email);
    if (idx < 0) return { email, score: -100 };

    let score = 0;
    // Look at the 200 chars BEFORE this email
    const before = lowerText.slice(Math.max(0, idx - 200), idx);
    // ACORD 25 puts the producer block in the top-left, which appears FIRST in extracted text
    // Boost emails appearing in the first 25% of the document
    if (idx < text.length * 0.25) score += 10;
    // Strong producer hints nearby
    for (const hint of PRODUCER_HINTS) {
      if (before.includes(hint)) score += 20;
    }
    // Negative hints reduce score
    for (const hint of NEGATIVE_HINTS) {
      if (before.includes(hint)) score -= 15;
    }
    // De-prioritize obvious non-producer domains (the carrier itself)
    if (email.endsWith("@gmail.com") || email.endsWith("@yahoo.com") || email.endsWith("@hotmail.com")) {
      score -= 5;
    }
    return { email, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // The top-scored email is the most likely producer email — but only if it scored above 0
  if (scored[0] && scored[0].score > 0) {
    result.producerEmail = scored[0].email;
    result.otherEmails = scored.slice(1).map(s => s.email);
  } else {
    // No strong winner — return all candidates for manual review, with best guess as producer
    result.producerEmail = scored[0]?.email || null;
    result.otherEmails = scored.slice(1).map(s => s.email);
  }

  // Look for expiration dates — common ACORD format: "EXPIRATION" near "MM/DD/YYYY"
  const expMatches = text.match(/EXPIRATION[\s\S]{0,80}?(\d{1,2}\/\d{1,2}\/\d{2,4})/gi);
  if (expMatches) {
    for (const m of expMatches) {
      const date = m.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1];
      if (date) result.expirationDates.push(date);
    }
  }
  // Also look for "POLICY EXP" (alternate label)
  const expMatches2 = text.match(/POLICY\s+EXP[\s\S]{0,40}?(\d{1,2}\/\d{1,2}\/\d{2,4})/gi);
  if (expMatches2) {
    for (const m of expMatches2) {
      const date = m.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)?.[1];
      if (date && !result.expirationDates.includes(date)) result.expirationDates.push(date);
    }
  }

  return result;
}
