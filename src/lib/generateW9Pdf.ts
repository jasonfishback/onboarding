/**
 * W-9 PDF Generator (Rev. March 2024)
 * Closely mirrors the actual IRS Form W-9 layout.
 * Uses pdf-lib with Helvetica — all text must be WinAnsi safe.
 */
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";

// ── Colors matching the real W-9 ─────────────────────────────────────────────
const BLACK   = rgb(0, 0, 0);
const DGRAY   = rgb(0.2, 0.2, 0.2);
const GRAY    = rgb(0.5, 0.5, 0.5);
const LGRAY   = rgb(0.88, 0.88, 0.88);
const BLUE    = rgb(0.063, 0.263, 0.525);   // IRS dark navy blue
const LBLUE   = rgb(0.82, 0.89, 0.96);      // light blue field tint
const WHITE   = rgb(1, 1, 1);
const RED_D   = rgb(0.7, 0.0, 0.0);

// ── Page dimensions (US Letter) ────────────────────────────────────────────
const W = 612;
const H = 792;
const ML = 28;  // left margin
const MR = 28;  // right margin
const CW = W - ML - MR;  // content width = 556

function san(t: string): string {
  return String(t ?? "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/\t/g, " ")
    .replace(/[^\x00-\xFF]/g, "");
}

function dr(page: PDFPage, x: number, y: number, w: number, h: number,
  fill = WHITE, stroke = BLACK, sw = 0.6) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: stroke, borderWidth: sw });
}

function dl(page: PDFPage, x1: number, y1: number, x2: number, y2: number,
  w = 0.5, color = BLACK) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w, color });
}

function t(page: PDFPage, text: string, x: number, y: number, size: number,
  font: PDFFont, color = BLACK) {
  const s = san(text);
  if (!s) return;
  page.drawText(s, { x, y, size, font, color });
}

function checkbox(page: PDFPage, x: number, y: number, size: number,
  checked: boolean, font: PDFFont) {
  dr(page, x, y, size, size, WHITE, BLACK, 0.8);
  if (checked) {
    t(page, "X", x + 1.5, y + 1.5, size - 2, font, BLACK);
  }
}

// Field with label above and value below — looks like the real W-9 fields
function field(page: PDFPage, label: string, value: string, x: number, y: number,
  w: number, h: number, reg: PDFFont, bold: PDFFont, labelSize = 6.5, valSize = 10) {
  dr(page, x, y - h, w, h, LBLUE, BLACK, 0.6);
  t(page, label, x + 2, y - labelSize - 1, labelSize, reg, DGRAY);
  if (value) t(page, value, x + 3, y - h + 3, valSize, bold, BLACK);
}

function tinBox(page: PDFPage, x: number, y: number, w: number, h: number,
  label: string, digits: string[], reg: PDFFont, bold: PDFFont) {
  dr(page, x, y - h, w, h, WHITE, BLACK, 0.8);
  t(page, label, x + 2, y - 7, 6, reg, DGRAY);

  // individual digit cells
  const cellW = (w - 4) / Math.max(digits.length, 9);
  for (let i = 0; i < digits.length; i++) {
    const cx = x + 2 + i * cellW;
    if (i > 0) dl(page, cx, y - h + 2, cx, y - 10, 0.4, GRAY);
    if (digits[i]) t(page, digits[i], cx + cellW / 2 - 3, y - h + 5, 12, bold, BLACK);
  }
}

export async function generateW9PDF(
  w9Data: Record<string, string>,
  companyData: Record<string, unknown>,
  sigData: Record<string, unknown>
): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([W, H]);

  const today = new Date().toLocaleDateString("en-US",
    { month: "2-digit", day: "2-digit", year: "numeric" });

  // Pull data
  const name      = san(w9Data.name      || String(companyData.legalName ?? ""));
  const dba       = san(w9Data.dba       || String(companyData.dba ?? ""));
  const addr      = san(w9Data.address   || String(companyData.address ?? ""));
  const csz       = san([w9Data.city || companyData.city, w9Data.state || companyData.state, w9Data.zip || companyData.zip].filter(Boolean).join(", "));
  const ein       = san(w9Data.ein       || String(companyData.ein ?? "")).replace(/[^0-9]/g, "");
  const classif   = san(w9Data.classif   || "llc");
  const llcType   = san(w9Data.llcType   || "C");
  const signer    = san(String(sigData.signerName ?? ""));

  // ── TOP BLUE HEADER BAR ───────────────────────────────────────────────────
  dr(page, 0, H - 52, W, 52, BLUE, BLUE, 0);

  // Form number box (white on blue)
  dr(page, ML, H - 50, 72, 46, WHITE, WHITE, 0);
  t(page, "Form  W-9",          ML + 3,  H - 20, 11.5, bold, BLUE);
  t(page, "(Rev. March 2024)",  ML + 3,  H - 30, 7.0,  reg,  BLUE);
  t(page, "Department of the Treasury", ML + 3, H - 39, 5.5, reg, GRAY);
  t(page, "Internal Revenue Service",   ML + 3, H - 46, 5.5, reg, GRAY);

  // Center title
  t(page, "Request for Taxpayer",                          ML + 80, H - 22, 12, bold, WHITE);
  t(page, "Identification Number and Certification",       ML + 80, H - 34, 12, bold, WHITE);
  t(page, "Go to www.irs.gov/FormW9 for instructions and the latest information.", ML + 80, H - 44, 6.5, reg, rgb(0.85, 0.92, 1.0));

  // Right box
  dr(page, W - MR - 105, H - 50, 105, 46, rgb(0.85, 0.89, 0.93), BLUE, 0.6);
  t(page, "Give form to the",  W - MR - 100, H - 16, 7.5, bold, BLUE);
  t(page, "requester. Do not", W - MR - 100, H - 26, 7.5, bold, BLUE);
  t(page, "send to the IRS.",  W - MR - 100, H - 36, 7.5, bold, BLUE);

  // ── NOTE BELOW HEADER ─────────────────────────────────────────────────────
  let y = H - 54;
  t(page, "Before you begin. For guidance related to the purpose of Form W-9, see Purpose of Form, below. Print or type. See Specific Instructions on page 3.", ML, y - 7, 6, reg, DGRAY);

  // ── LINE 1: Name ──────────────────────────────────────────────────────────
  y -= 12;
  field(page, "1  Name of entity/individual. An entry is required.", name, ML, y, CW, 22, reg, bold);
  y -= 22;

  // ── LINE 2: Business name ─────────────────────────────────────────────────
  field(page, "2  Business name/disregarded entity name, if different from above.", dba, ML, y, CW, 22, reg, bold);
  y -= 22;

  // ── LINE 3a + 4: Tax Classification (left 63%) + Exemptions (right 37%) ──
  const leftW  = Math.round(CW * 0.63);
  const rightW = CW - leftW;

  // 3a box
  dr(page, ML, y - 42, leftW, 42, LBLUE, BLACK, 0.6);
  t(page, "3a  Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1.", ML + 2, y - 7, 6.5, reg, DGRAY);
  t(page, "Check only one of the following seven boxes.", ML + 2, y - 14, 6.5, reg, DGRAY);

  // Row 1 of checkboxes
  const cbY1 = y - 24;
  const items: [string, string, number][] = [
    ["Individual/sole proprietor", "individual", ML + 2],
    ["C corporation",              "ccorp",      ML + 102],
    ["S corporation",              "scorp",      ML + 154],
    ["Partnership",                "partnership",ML + 206],
    ["Trust/estate",               "trust",      ML + 254],
  ];
  for (const [label, val, cx] of items) {
    checkbox(page, cx, cbY1, 8, classif === val, bold);
    t(page, label, cx + 10, cbY1 + 1, 6.5, reg, BLACK);
  }

  // Row 2: LLC
  const cbY2 = y - 37;
  checkbox(page, ML + 2, cbY2, 8, classif === "llc", bold);
  t(page, "LLC. Enter the tax classification (C = C corporation, S = S corporation, P = Partnership)", ML + 12, cbY2 + 1, 6.5, reg, BLACK);
  // LLC type entry box
  dr(page, ML + leftW - 20, cbY2 - 1, 16, 10, WHITE, BLACK, 0.7);
  if (classif === "llc" && llcType) t(page, llcType, ML + leftW - 16, cbY2 + 1, 8, bold, BLACK);

  // 4: Exemptions (right side)
  dr(page, ML + leftW, y - 42, rightW, 42, LBLUE, BLACK, 0.6);
  t(page, "4  Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):", ML + leftW + 2, y - 7, 6, reg, DGRAY);
  t(page, "Exempt payee code (if any)", ML + leftW + 2, y - 18, 6.5, reg, DGRAY);
  dr(page, ML + leftW + 2, y - 30, 60, 10, WHITE, BLACK, 0.6);  // empty box

  t(page, "Exemption from FATCA reporting", ML + leftW + 2, y - 33, 6.5, reg, DGRAY);
  t(page, "code (if any)",                  ML + leftW + 2, y - 40, 6.5, reg, DGRAY);
  dr(page, ML + leftW + 2, y - 42, 60, 10, WHITE, BLACK, 0.6);

  y -= 42;

  // ── LINE 5: Address ───────────────────────────────────────────────────────
  field(page, "5  Address (number, street, and apt. or suite no.)  See instructions.", addr, ML, y, CW, 22, reg, bold);
  y -= 22;

  // ── LINE 6: City/State/ZIP ────────────────────────────────────────────────
  field(page, "6  City, state, and ZIP code", csz, ML, y, CW, 22, reg, bold);
  y -= 22;

  // ── LINE 7: Account numbers ───────────────────────────────────────────────
  field(page, "7  List account number(s) here (optional)", "", ML, y, CW, 18, reg, bold, 6.5, 9);
  y -= 18;

  // ── PART I HEADER ─────────────────────────────────────────────────────────
  dr(page, ML, y - 14, CW, 14, BLUE, BLUE, 0);
  t(page, "Part I",                                         ML + 3,  y - 10, 9, bold, WHITE);
  t(page, "Taxpayer Identification Number (TIN)",           ML + 40, y - 10, 9, bold, WHITE);
  y -= 14;

  // Part I body
  const partIH = 58;
  dr(page, ML, y - partIH, CW, partIH, LBLUE, BLACK, 0.6);

  const tinBodyX = W - MR - 180;
  const tinBodyW = 178;

  // Instructions text (left side)
  const instLines = [
    "Enter your TIN in the appropriate box. The TIN provided must match the name",
    "given on line 1 to avoid backup withholding. For individuals, this is generally",
    "your social security number (SSN). However, for a resident alien, sole",
    "proprietor, or disregarded entity, see the instructions for Part I, later. For",
    "other entities, it is your employer identification number (EIN). If you do not",
    "have a number, see How to get a TIN, later.",
  ];
  let iy = y - 9;
  for (const ln of instLines) {
    t(page, ln, ML + 3, iy, 6.5, reg, DGRAY);
    iy -= 8;
  }

  // SSN box (top half)
  const ssnH = 26;
  dr(page, tinBodyX, y - ssnH, tinBodyW, ssnH, WHITE, BLACK, 0.8);
  t(page, "Social security number", tinBodyX + 3, y - 9, 7, reg, DGRAY);
  // SSN dashes
  t(page, "–", tinBodyX + 36, y - 22, 10, reg, DGRAY);
  t(page, "–", tinBodyX + 72, y - 22, 10, reg, DGRAY);
  // SSN digit cells
  const ssnSegs = [[3, 4], [2, 42], [4, 80]];
  for (const [count, ox] of ssnSegs) {
    for (let i = 0; i < count; i++) {
      dl(page, tinBodyX + ox + i * 8, y - 13, tinBodyX + ox + i * 8, y - ssnH + 2, 0.4, LGRAY);
    }
  }

  // OR separator
  t(page, "or", tinBodyX + tinBodyW / 2 - 5, y - ssnH - 5, 7, reg, DGRAY);

  // EIN box (bottom half)
  const einBoxY = y - ssnH - 12;
  dr(page, tinBodyX, einBoxY - 20, tinBodyW, 20, WHITE, BLACK, 0.8);
  t(page, "Employer identification number", tinBodyX + 3, einBoxY - 9, 7, reg, DGRAY);
  t(page, "–", tinBodyX + 24, einBoxY - 18, 10, reg, DGRAY);

  // Fill EIN digits
  if (ein.length >= 2) {
    const p1 = ein.slice(0, 2);
    const p2 = ein.slice(2);
    t(page, p1, tinBodyX + 4,  einBoxY - 18, 13, bold, BLACK);
    t(page, p2, tinBodyX + 36, einBoxY - 18, 13, bold, BLACK);
  }

  // EIN digit separators
  for (let i = 0; i < 2; i++) dl(page, tinBodyX + 12 + i * 8, einBoxY - 12, tinBodyX + 12 + i * 8, einBoxY - 19, 0.4, LGRAY);
  for (let i = 0; i < 7; i++) dl(page, tinBodyX + 36 + i * 8, einBoxY - 12, tinBodyX + 36 + i * 8, einBoxY - 19, 0.4, LGRAY);

  y -= partIH;

  // ── PART II HEADER ────────────────────────────────────────────────────────
  dr(page, ML, y - 14, CW, 14, BLUE, BLUE, 0);
  t(page, "Part II", ML + 3, y - 10, 9, bold, WHITE);
  t(page, "Certification", ML + 40, y - 10, 9, bold, WHITE);
  y -= 14;

  // Certification body
  const certH = 100;
  dr(page, ML, y - certH, CW, certH, LBLUE, BLACK, 0.6);

  const certLines = [
    "Under penalties of perjury, I certify that:",
    "1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and",
    "2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the",
    "   Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or",
    "   (c) the IRS has notified me that I am no longer subject to backup withholding; and",
    "3. I am a U.S. citizen or other U.S. person (defined below); and",
    "4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.",
    "",
    "Certification instructions. You must cross out item 2 above if you have been notified by the IRS that you are currently subject to",
    "backup withholding. For real estate transactions, item 2 does not apply.",
  ];
  let cy = y - 9;
  for (const cl of certLines) {
    t(page, cl, ML + 3, cy, 6.5, reg, DGRAY);
    cy -= 7.8;
  }

  y -= certH;

  // ── SIGNATURE BLOCK ───────────────────────────────────────────────────────
  const sigBlockH = 32;
  dr(page, ML, y - sigBlockH, CW, sigBlockH, WHITE, BLACK, 0.8);

  // "Sign Here" tag (blue box on left)
  dr(page, ML, y - sigBlockH, 38, sigBlockH, BLUE, BLUE, 0);
  t(page, "Sign",  ML + 5, y - 12, 9, bold, WHITE);
  t(page, "Here",  ML + 4, y - 23, 9, bold, WHITE);

  // Signature line
  const sigLineX = ML + 42;
  const sigLineW = CW - 42 - 110;
  dl(page, sigLineX, y - sigBlockH + 6, sigLineX + sigLineW, y - sigBlockH + 6, 0.8, BLACK);
  t(page, "Signature of U.S. person", sigLineX + 2, y - 9, 7, reg, DGRAY);

  // Date line
  const dateX = sigLineX + sigLineW + 8;
  dl(page, dateX, y - sigBlockH + 6, ML + CW - 2, y - sigBlockH + 6, 0.8, BLACK);
  t(page, "Date", dateX + 2, y - 9, 7, reg, DGRAY);

  // Fill in signer name (italic-style large)
  if (signer) t(page, signer, sigLineX + 4, y - sigBlockH + 10, 13, bold, BLACK);
  t(page, today, dateX + 4, y - sigBlockH + 10, 10, reg, BLACK);

  y -= sigBlockH;

  // ── FOOTER ────────────────────────────────────────────────────────────────
  dl(page, ML, y - 4, W - MR, y - 4, 0.5, LGRAY);
  t(page, "Cat. No. 10231X", ML, y - 13, 7, reg, GRAY);
  t(page, "Form W-9 (Rev. 3-2024)", W - MR - 105, y - 13, 7, reg, GRAY);

  // ── ELECTRONIC SUBMISSION NOTE ────────────────────────────────────────────
  y -= 20;
  dr(page, ML, y - 26, CW, 26, rgb(1.0, 0.97, 0.87), rgb(0.75, 0.55, 0), 0.8);
  t(page, "NOTE: This W-9 was completed electronically via the Simon Express Logistics LLC carrier onboarding portal.", ML + 5, y - 10, 7.5, bold, rgb(0.4, 0.25, 0));
  t(page, `Submitted by: ${signer || "—"}   |   Company: ${name}   |   EIN: ${ein || "—"}   |   Date: ${today}`, ML + 5, y - 21, 7, reg, rgb(0.4, 0.25, 0));

  return doc.save();
}
