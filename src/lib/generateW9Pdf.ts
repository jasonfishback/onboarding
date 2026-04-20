import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";

const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.93, 0.93, 0.93);
const BLUE = rgb(0.0, 0.18, 0.42);
const RED = rgb(0.75, 0.0, 0.0);
const WHITE = rgb(1, 1, 1);

const W = 612;
const H = 792;
const M = 36;

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, w = 0.5, color = BLACK) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w, color });
}

function rect(page: PDFPage, x: number, y: number, w: number, h: number, fill = WHITE, border = BLACK, bw = 0.75) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: border, borderWidth: bw });
}

function txt(page: PDFPage, t: string, x: number, y: number, size: number, font: PDFFont, color = BLACK) {
  // Sanitize - remove non-latin-1 chars
  const clean = t.replace(/[^\x00-\xFF]/g, "").replace(/\t/g, "  ");
  page.drawText(clean, { x, y, size, font, color });
}

export async function generateW9PDF(w9Data: Record<string, string>, companyData: Record<string, unknown>, sigData: Record<string, unknown>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([W, H]);

  const today = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

  // ── HEADER ─────────────────────────────────────────────────────────────────
  // Left box - Form number
  rect(page, M, H - 72, 90, 58, LIGHT, BLACK, 0.75);
  txt(page, "Form  W-9", M + 4, H - 44, 14, bold, BLACK);
  txt(page, "(Rev. March 2024)", M + 4, H - 56, 7, regular, BLACK);
  txt(page, "Department of the Treasury", M + 4, H - 66, 6, regular, BLACK);
  txt(page, "Internal Revenue Service", M + 4, H - 74, 6, regular, BLACK);

  // Center - Title
  txt(page, "Request for Taxpayer", M + 100, H - 44, 13, bold, BLACK);
  txt(page, "Identification Number and Certification", M + 100, H - 57, 13, bold, BLACK);
  txt(page, "Go to www.irs.gov/FormW9 for instructions and the latest information.", M + 100, H - 68, 7, regular, DARK);

  // Right box
  rect(page, W - 148, H - 72, 112, 58, LIGHT, BLACK, 0.75);
  txt(page, "Give form to the", W - 144, H - 44, 7.5, bold, BLACK);
  txt(page, "requester. Do not", W - 144, H - 54, 7.5, bold, BLACK);
  txt(page, "send to the IRS.", W - 144, H - 64, 7.5, bold, BLACK);

  // ── LINE 1: Entity Name ────────────────────────────────────────────────────
  let y = H - 86;
  rect(page, M, y - 22, W - M * 2, 22, WHITE, BLACK, 0.75);
  txt(page, "1  Name of entity/individual. An entry is required.", M + 2, y - 8, 7, regular, DARK);
  txt(page, String(w9Data.name || companyData.legalName || ""), M + 4, y - 20, 10, bold, BLACK);

  // ── LINE 2: Business Name ─────────────────────────────────────────────────
  y -= 22;
  rect(page, M, y - 22, W - M * 2, 22, WHITE, BLACK, 0.75);
  txt(page, "2  Business name/disregarded entity name, if different from above.", M + 2, y - 8, 7, regular, DARK);
  const dba = String(w9Data.dba || companyData.dba || "");
  if (dba) txt(page, dba, M + 4, y - 20, 10, bold, BLACK);

  // ── LINE 3a: Tax Classification ───────────────────────────────────────────
  y -= 22;
  const classifBoxH = 38;
  rect(page, M, y - classifBoxH, (W - M * 2) * 0.65, classifBoxH, WHITE, BLACK, 0.75);
  rect(page, M + (W - M * 2) * 0.65, y - classifBoxH, (W - M * 2) * 0.35, classifBoxH, WHITE, BLACK, 0.75);
  txt(page, "3a  Check the appropriate box for federal tax classification:", M + 2, y - 8, 7, regular, DARK);

  const classif = String(w9Data.classif || "llc");
  const options: [string, string, number][] = [
    ["Individual/sole proprietor", "individual", M + 4],
    ["C corporation", "ccorp", M + 100],
    ["S corporation", "scorp", M + 160],
    ["Partnership", "partnership", M + 216],
    ["LLC", "llc", M + 4],
  ];
  const row1 = options.slice(0, 4);
  const row2 = options.slice(4);

  for (const [label, val, x] of row1) {
    const checked = classif === val;
    rect(page, x, y - 22, 9, 9, WHITE, BLACK, 0.75);
    if (checked) {
      txt(page, "X", x + 1, y - 21, 8, bold, BLACK);
    }
    txt(page, label, x + 12, y - 21, 7, regular, BLACK);
  }
  // LLC row
  rect(page, M + 4, y - 33, 9, 9, WHITE, BLACK, 0.75);
  if (classif === "llc") txt(page, "X", M + 5, y - 32, 8, bold, BLACK);
  txt(page, "LLC. Enter tax classification (C, S, or P):", M + 16, y - 32, 7, regular, BLACK);
  const llcCode = classif === "llc" ? (String(w9Data.llcType || "C")) : "";
  txt(page, llcCode, M + 160, y - 32, 9, bold, BLACK);

  // 4: Exemptions box (right side)
  txt(page, "4  Exemptions (codes apply only to certain entities):", M + (W - M * 2) * 0.65 + 3, y - 8, 7, regular, DARK);
  txt(page, "Exempt payee code (if any):", M + (W - M * 2) * 0.65 + 3, y - 18, 7, regular, DARK);
  txt(page, String(w9Data.exemptCode || ""), M + (W - M * 2) * 0.65 + 3, y - 28, 9, bold, BLACK);
  txt(page, "FATCA code (if any):", M + (W - M * 2) * 0.65 + 3, y - 36, 7, regular, DARK);

  // ── LINE 5: Address ───────────────────────────────────────────────────────
  y -= classifBoxH;
  const halfW = (W - M * 2) * 0.65;
  rect(page, M, y - 22, W - M * 2, 22, WHITE, BLACK, 0.75);
  txt(page, "5  Address (number, street, and apt. or suite no.)  See instructions.", M + 2, y - 8, 7, regular, DARK);
  txt(page, String(w9Data.address || companyData.address || ""), M + 4, y - 20, 10, bold, BLACK);

  // ── LINE 6: City/State/ZIP ────────────────────────────────────────────────
  y -= 22;
  rect(page, M, y - 22, halfW, 22, WHITE, BLACK, 0.75);
  txt(page, "6  City, state, and ZIP code", M + 2, y - 8, 7, regular, DARK);
  const cityStateZip = [w9Data.city || companyData.city, w9Data.state || companyData.state, w9Data.zip || companyData.zip].filter(Boolean).join(", ");
  txt(page, String(cityStateZip), M + 4, y - 20, 10, bold, BLACK);

  // LINE 7
  y -= 22;
  rect(page, M, y - 18, W - M * 2, 18, WHITE, BLACK, 0.75);
  txt(page, "7  List account number(s) here (optional)", M + 2, y - 8, 7, regular, DARK);

  // ── PART I ────────────────────────────────────────────────────────────────
  y -= 18;
  rect(page, M, y - 56, W - M * 2, 56, LIGHT, BLACK, 1);
  txt(page, "Part I", M + 3, y - 12, 10, bold, BLUE);
  txt(page, "Taxpayer Identification Number (TIN)", M + 46, y - 12, 10, bold, BLACK);
  txt(page, "Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1.", M + 3, y - 22, 7, regular, DARK);
  txt(page, "For individuals, this is your SSN. For other entities, it is your EIN.", M + 3, y - 31, 7, regular, DARK);

  // SSN box
  const tinX = W - M - 175;
  rect(page, tinX, y - 55, 170, 52, WHITE, BLACK, 1);
  txt(page, "Social security number", tinX + 4, y - 12, 7.5, regular, DARK);
  txt(page, "– –", tinX + 60, y - 28, 11, regular, DARK);
  // EIN separator
  line(page, tinX, y - 35, tinX + 170, y - 35, 0.5);
  txt(page, "or", tinX + 4, y - 43, 7.5, regular, DARK);
  txt(page, "Employer identification number", tinX + 4, y - 43, 7.5, regular, DARK);
  txt(page, "–", tinX + 90, y - 52, 11, regular, DARK);

  // Fill in EIN
  const ein = String(w9Data.ein || companyData.ein || "");
  if (ein) {
    const formattedEIN = ein.replace(/[^0-9]/g, "");
    if (formattedEIN.length >= 2) {
      const part1 = formattedEIN.slice(0, 2);
      const part2 = formattedEIN.slice(2);
      txt(page, part1, tinX + 10, y - 52, 13, bold, BLACK);
      txt(page, part2, tinX + 105, y - 52, 13, bold, BLACK);
    } else {
      txt(page, formattedEIN, tinX + 10, y - 52, 13, bold, BLACK);
    }
  }

  // ── PART II: Certification ─────────────────────────────────────────────────
  y -= 56;
  rect(page, M, y - 98, W - M * 2, 98, WHITE, BLACK, 1);
  txt(page, "Part II", M + 3, y - 12, 10, bold, BLUE);
  txt(page, "Certification", M + 46, y - 12, 10, bold, BLACK);

  const certLines = [
    "Under penalties of perjury, I certify that:",
    "1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and",
    "2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the IRS that I am",
    "   subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer",
    "   subject to backup withholding; and",
    "3. I am a U.S. citizen or other U.S. person; and",
    "4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.",
  ];
  let cy = y - 23;
  for (const cl of certLines) {
    txt(page, cl, M + 3, cy, 7, regular, DARK);
    cy -= 9;
  }

  // Signature line
  line(page, M, y - 88, (W - M) * 0.7, y - 88, 1);
  line(page, (W - M) * 0.7 + 10, y - 88, W - M, y - 88, 1);
  txt(page, "Sign", M + 3, y - 82, 8, bold, BLUE);
  txt(page, "Here", M + 3, y - 91, 8, bold, BLUE);
  txt(page, "Signature of U.S. person", M + 32, y - 82, 7.5, regular, DARK);
  txt(page, "Date", (W - M) * 0.7 + 13, y - 82, 7.5, regular, DARK);

  // Fill signature
  const signerName = String(sigData.signerName || w9Data.name || "");
  if (signerName) {
    txt(page, signerName, M + 32, y - 93, 12, bold, BLACK);
  }
  txt(page, today, (W - M) * 0.7 + 13, y - 93, 10, regular, BLACK);

  // ── FOOTER ────────────────────────────────────────────────────────────────
  y -= 98;
  line(page, M, y - 4, W - M, y - 4, 0.5, GRAY);
  txt(page, "Cat. No. 10231X", M, y - 14, 7, regular, GRAY);
  txt(page, "Form W-9 (Rev. 3-2024)", W - M - 100, y - 14, 7, regular, GRAY);

  // ── WATERMARK NOTE ────────────────────────────────────────────────────────
  y -= 22;
  rect(page, M, y - 28, W - M * 2, 28, rgb(1, 0.97, 0.87), rgb(0.8, 0.6, 0), 1);
  txt(page, "This W-9 was completed electronically during carrier onboarding with Simon Express Logistics LLC.", M + 6, y - 11, 8, bold, rgb(0.5, 0.3, 0));
  txt(page, `Submitted by: ${signerName || ""}   |   Company: ${String(companyData.legalName || "")}   |   Date: ${today}`, M + 6, y - 22, 7.5, regular, rgb(0.4, 0.25, 0));

  return doc.save();
}
