// A signer's legal name must include BOTH a first and last name — never a single
// name like "Roy". Used to gate every place a person signs (agreement, WC
// exemption) on the client AND enforced server-side on submit. No exceptions.
//
// Rule: at least two whitespace-separated parts, with the first and last part
// each containing at least two letters (so "Roy" fails, "Roy S" fails on the
// bare initial, "Roy Smith" / "Bo Ng" pass).
export function isFullName(raw: string | null | undefined): boolean {
  const parts = String(raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  const letters = (t: string) => (t.match(/[A-Za-z]/g) || []).length;
  return letters(parts[0]) >= 2 && letters(parts[parts.length - 1]) >= 2;
}
