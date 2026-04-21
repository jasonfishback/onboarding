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

  // no blue — all black
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
  // Label y=278.5, blank input area runs ~290 to ~302 — place text at ~283 (just below label)
  if (addr) drawText(page, addr, 63, 285, 11, bold, BLACK);

  // ── Line 6: City, State, ZIP ───────────────────────────────────────────────
  // Label y=302.5, blank input area runs ~314 to ~326 — place text at ~307
  if (csz) drawText(page, csz, 63, 309, 11, bold, BLACK);

  // ── Part I: EIN ────────────────────────────────────────────────────────────
  // EIN boxes: x0=417.6, each cell is 14.4px wide
  // Group 1 (2 digits): cells at 417.6, 432.0  → centers at 424, 438
  // Dash at ~446
  // Group 2 (7 digits): cells at 460.8, 475.2, 489.6, 504.0, 518.4, 532.8, 547.2
  //                      → centers at 468, 482, 497, 511, 525, 540, 554
  if (ein) {
    const digits = ein.replace(/[^0-9]/g, "");
    const g1 = digits.slice(0, 2).split("");
    const g2 = digits.slice(2).split("");
    const g1Centers = [424, 438];
    const g2Centers = [468, 482, 497, 511, 525, 540, 554];
    g1.forEach((d, i) => { if (g1Centers[i]) drawText(page, d, g1Centers[i] - 3, 434, 11, bold, BLACK); });
    g2.forEach((d, i) => { if (g2Centers[i]) drawText(page, d, g2Centers[i] - 3, 434, 11, bold, BLACK); });
  }

  // ── Part II: Signature ─────────────────────────────────────────────────────
  // From pdfplumber: "Signature of U.S. person" label at y=582.1, x=76
  // Sign line at pdfplumber y≈600 → sign content should sit at ~y=577 (above the line)
  // "Date" label at y=590.5, x=385.6 → date content at ~y=577, x=400
  const signatureImage = String(sigData.signatureImage ?? "");
  if (signatureImage && signatureImage.startsWith("data:image/png;base64,")) {
    try {
      const base64Data = signatureImage.replace(/^data:image\/png;base64,/, "");
      const pngBytes = Buffer.from(base64Data, "base64");
      const embeddedSig = await doc.embedPng(pngBytes);
      const maxW = 250;
      const maxH = 28;
      const sigDims = embeddedSig.scale(Math.min(maxW / embeddedSig.width, maxH / embeddedSig.height));
      page.drawImage(embeddedSig, {
        x: 80,
        y: py(577, sigDims.height),
        width: sigDims.width,
        height: sigDims.height,
      });
    } catch {
      if (signer) drawText(page, signer, 80, 577, 13, bold, BLACK);
    }
  } else if (signer) {
    drawText(page, signer, 80, 577, 13, bold, BLACK);
  }
  // Date — moved up to match signature line
  drawText(page, today, 400, 577, 10, reg, BLACK);

  // ── Electronic submission note ─────────────────────────────────────────────
  drawText(page, "* Electronically signed via Simon Express Logistics LLC carrier onboarding portal *", 60, 616, 6.5, reg, rgb(0.5, 0.5, 0.5));

  return doc.save();
}
