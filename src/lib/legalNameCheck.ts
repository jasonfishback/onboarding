// src/lib/legalNameCheck.ts (mirrored in kpi: lib/setup/legalNameCheck.ts — keep in sync)
//
// Carrier-onboarding guard for the "Legal Company Name" field.
//
// Carriers that factor keep typing their FACTORING company (RTS, OTR, Loves
// Solutions, ...) into Legal Company Name — 18 completed signups Jun–Oct 2026
// (e.g. BHANWALA TRUCKING INC submitted as "RTS Financial Service Inc"). The
// FMCSA lookup on step 1 already told us who they are, so we can refuse the
// swap before they leave step 2. Pure functions; used by Step2.tsx (client)
// and /api/submit (server backstop).

/** Well-known transportation factoring companies / lenders. Matched as whole
 *  words, case-insensitive, after punctuation is stripped. */
const FACTORING_COMPANIES: RegExp[] = [
  /\brts\b/,                       // RTS Financial Service
  /\botr\b/,                       // OTR Solutions / OTR Capital
  /\btafs\b/,
  /\btriumph\b/,                   // Triumph Business Capital
  /\be ?capital\b/,                // eCapital
  /\bapex\b/,                      // Apex Capital
  /\bwex\b/,                       // WEX Capital
  /\bloves?'?s? solutions\b/,      // Loves Solutions / Love's Solutions
  /\bbobtail\b/,
  /\bthunder funding\b/,
  /\bporter (freight )?(capital|funding)\b/,
  /\bcompass\b/,                   // Compass Funding / "compass factory"
  /\bfactorloads?\b/,
  /\bflat ?rate funding\b/,
  /\bsingh financ/,
  /\btrucking pros?\b/,
  /\bcashway\b/,
  /\bpartners funding\b/,
  /\boperation finance\b/,
  /\bcapital depot\b/,
  /\bfirstline funding\b/,
];

/** Generic words that mark a finance company rather than a motor carrier. */
const FACTORING_WORDS = /\b(factoring|factor|funding|financial|finance|capital)\b/;

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose company-name key: lowercase, punctuation gone, common suffixes gone. */
export function companyKey(s: unknown): string {
  return norm(s)
    .replace(/'/g, "")
    .replace(/\b(inc|llc|l l c|corp|corporation|co|ltd|limited|company|dba)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the string names a factoring company / lender. */
export function looksLikeFactoringCompany(name: unknown): boolean {
  const n = norm(name);
  if (!n) return false;
  if (FACTORING_COMPANIES.some((re) => re.test(n))) return true;
  return FACTORING_WORDS.test(n);
}

export type LegalNameVerdict =
  | { level: "ok" }
  /** Hard block: typed name is the factoring company, not the carrier. */
  | { level: "block"; reason: "matches_factoring_name" | "looks_like_factoring" }
  /** Soft: differs from FMCSA but is not factoring-shaped (DBA confusion etc.). */
  | { level: "warn"; reason: "differs_from_fmcsa" };

/**
 * Judge the Legal Company Name a carrier typed on step 2.
 *
 * - If it equals the Factoring Company Name they also typed → block.
 * - If it looks like a factoring company AND it is not what FMCSA says the
 *   carrier is called → block. (A carrier legitimately named e.g.
 *   "CAPITAL EXPRESS INC" is fine because it matches FMCSA.)
 * - If FMCSA gave us a name and the typed one is materially different → warn.
 */
export function checkLegalName(input: {
  legalName: unknown;
  fmcsaName?: unknown;
  factoringName?: unknown;
}): LegalNameVerdict {
  const typed = companyKey(input.legalName);
  if (!typed) return { level: "ok" };
  const fmcsa = companyKey(input.fmcsaName);
  const factoring = companyKey(input.factoringName);

  const sameAsFmcsa = !!fmcsa && typed === fmcsa;
  if (sameAsFmcsa) return { level: "ok" };

  if (factoring && typed === factoring) {
    return { level: "block", reason: "matches_factoring_name" };
  }
  if (looksLikeFactoringCompany(input.legalName)) {
    return { level: "block", reason: "looks_like_factoring" };
  }
  if (fmcsa) return { level: "warn", reason: "differs_from_fmcsa" };
  return { level: "ok" };
}
