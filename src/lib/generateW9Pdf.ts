/**
 * W-9 PDF Generator
 * Uses the actual IRS Form W-9 (Rev. March 2024) page 1 as a template,
 * then overlays the carrier's data at the exact field positions.
 *
 * Coordinate system notes:
 *   - pdfplumber reports y from TOP (0 = top of page, 792 = bottom)
 *   - pdf-lib uses y from BOTTOM (0 = bottom of page, 792 = top)
 *   - Conversion: pdf_lib_y = pageHeight - pdfplumber_y - fontSize
 *
 * Key field positions (from pdfplumber analysis):
 *   Line 1 (name):        label y=98.5  → input area below ~109
 *   Line 2 (business):    label y=134.5 → input area below ~145
 *   Checkboxes row 1:     y=180.2 (top of boxes)
 *   LLC checkbox:         y=193.5
 *   LLC type entry:       after dots ~y=195, x~372-415
 *   Line 5 (address):     label y=278.5 → input area below ~289
 *   Line 6 (city/state):  label y=302.5 → input area below ~313
 *   SSN boxes:            y=360-396, x=417-576
 *   EIN boxes:            y=408-444, x=417-576
 *   Signature line:       y~580-600
 *   Date:                 y~590, x=385+
 */

import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import { W9_PAGE1_B64 } from "./w9Template";

const H = 791.968; // actual page height from pdfplumber

// Convert pdfplumber top-y to pdf-lib bottom-y
function py(topY: number, fontSize = 0): number {
  return H - topY - fontSize;
}

function san(t: unknown): string {
  return String(t ?? "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/\t/g, " ")
    .replace(/[^\x00-\xFF]/g, "");
}

function drawText(page: ReturnType<PDFDocument["addPage"]>, text: string, x: number, topY: number, size: number, font: PDFFont, color = rgb(0, 0, 1)) {
  const s = san(text);
  if (!s) return;
  page.drawText(s, { x, y: py(topY, size), size, font, color });
}

export async function generateW9PDF(
  w9Data: Record<string, string>,
  companyData: Record<string, unknown>,
  sigData: Record<string, unknown>
): Promise<Uint8Array> {

  // Load the real IRS W-9 page 1 as template
  const templateBytes = Buffer.from(W9_PAGE1_B64, "base64");
  const doc = await PDFDocument.load(templateBytes);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.getPages()[0];

  const today = new Date().toLocaleDateString("en-US",
    { month: "2-digit", day: "2-digit", year: "numeric" });

  // Pull values
  const name    = san(w9Data.name    || String(companyData.legalName  ?? ""));
  const dba     = san(w9Data.dba     || String(companyData.dba        ?? ""));
  const addr    = san(w9Data.address || String(companyData.address    ?? ""));
  const city    = san(w9Data.city    || String(companyData.city       ?? ""));
  const state   = san(w9Data.state   || String(companyData.state      ?? ""));
  const zip     = san(w9Data.zip     || String(companyData.zip        ?? ""));
  const csz     = [city, state, zip].filter(Boolean).join(", ");
  const ein     = san(w9Data.ein     || String(companyData.ein        ?? "")).replace(/[^0-9]/g, "");
  const classif = san(w9Data.classif || "llc");
  const llcType = san(w9Data.llcType || "C");
  const signer  = san(String(sigData.signerName ?? ""));

  const BLUE = rgb(0, 0, 0.8);  // blue ink for filled data
  const BLACK = rgb(0, 0, 0);

  // ── Line 1: Entity/Individual Name ────────────────────────────────────────
  // Label is at y=98.5; the blank field is from ~108 to ~134
  // Place input text at y≈119 (middle of field)
  if (name) drawText(page, name, 63, 119, 11, bold, BLACK);

  // ── Line 2: Business Name ─────────────────────────────────────────────────
  // Label y=134.5, field runs ~145 to ~158
  if (dba) drawText(page, dba, 63, 150, 11, bold, BLACK);

  // ── Line 3a: Tax Classification checkboxes ─────────────────────────────────
  // Checkbox rects are at pdfplumber y=180.2 (top), so center of box = y≈184
  // Checkbox x positions from rects:
  //   Individual/sole: x0=73
  //   C corporation:   x0=180
  //   S corporation:   x0=252
  //   Partnership:     x0=324
  //   Trust/estate:    x0=388.8
  //   LLC:             x0=73, y0=193.5
  //   Other:           x0=73, y0=230
  const cbMap: Record<string, { x: number; ty: number }> = {
    individual:  { x: 74,    ty: 181 },
    ccorp:       { x: 181,   ty: 181 },
    scorp:       { x: 253,   ty: 181 },
    partnership: { x: 325,   ty: 181 },
    trust:       { x: 389,   ty: 181 },
    llc:         { x: 74,    ty: 194 },
    other:       { x: 74,    ty: 230 },
  };
  const cb = cbMap[classif];
  if (cb) {
    // Draw X inside the checkbox
    drawText(page, "X", cb.x + 1, cb.ty + 6, 7, bold, BLACK);
  }

  // LLC type entry (after the dots at ~x=415, y=195)
  if (classif === "llc" && llcType) {
    drawText(page, llcType, 415, 199, 9, bold, BLACK);
  }

  // ── Line 5: Address ────────────────────────────────────────────────────────
  // Label y=278.5, field runs ~289 to ~302
  if (addr) drawText(page, addr, 63, 294, 11, bold, BLACK);

  // ── Line 6: City, State, ZIP ───────────────────────────────────────────────
  // Label y=302.5, field runs ~313 to ~326
  if (csz) drawText(page, csz, 63, 318, 11, bold, BLACK);

  // ── Part I: EIN ────────────────────────────────────────────────────────────
  // EIN label at y=409.5, boxes at y=420-444
  // From rects: x0=417.6, boxes are 14.4 wide each
  // EIN format: XX-XXXXXXX  (2 digits dash 7 digits)
  // Box centers: digits 0-1 at x≈418-432, dash, digits 2-8 at x≈460-562
  if (ein) {
    const d1 = ein.slice(0, 2);  // first 2 digits
    const d2 = ein.slice(2);     // remaining digits
    // Place in the EIN cells - center of first group starts at x=418
    if (d1) drawText(page, d1.split("").join("  "), 421, 434, 11, bold, BLACK);
    if (d2) drawText(page, d2.split("").join("  "), 462, 434, 11, bold, BLACK);
  }

  // ── Part II: Signature ─────────────────────────────────────────────────────
  // Sign Here block: "Signature of U.S. person" label at y=582.1
  // Signature line appears to be around y≈595-600
  // Date label at y=590.5, x=385.6
  if (signer) {
    // Signature in cursive-style bold below the "Signature of U.S. person" label
    drawText(page, signer, 78, 594, 13, bold, BLUE);
  }
  // Date
  drawText(page, today, 387, 594, 10, reg, BLACK);

  // ── Electronic submission note ─────────────────────────────────────────────
  // Place below the "General Instructions" section, near bottom of form area
  // The General Instructions header is at y=609, so place note just above footer
  drawText(page, "* Electronically signed via Simon Express Logistics LLC carrier onboarding portal *", 60, 605, 6.5, reg, rgb(0.5, 0.5, 0.5));

  return doc.save();
}
