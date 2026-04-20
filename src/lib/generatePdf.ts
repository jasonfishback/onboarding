import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts, PDFImage } from "pdf-lib";

// ─── Colors ────────────────────────────────────────────────────────────────
const BLACK = rgb(0.1, 0.1, 0.1);
const RED = rgb(0.8, 0.106, 0.106);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY = rgb(0.93, 0.93, 0.93);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.133, 0.639, 0.333);

// ─── Layout constants ──────────────────────────────────────────────────────
const MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

// ─── Helper: add a new page with header/footer ─────────────────────────────
function addPage(doc: PDFDocument, fonts: Fonts, pageNum: number, totalPages?: number): { page: PDFPage; y: number } {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Header bar
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 40, width: PAGE_WIDTH, height: 40, color: BLACK });
  page.drawText("SIMON EXPRESS LOGISTICS LLC", {
    x: MARGIN, y: PAGE_HEIGHT - 26, size: 11, font: fonts.bold, color: WHITE,
  });
  page.drawText("Carrier Onboarding Packet", {
    x: PAGE_WIDTH - MARGIN - 130, y: PAGE_HEIGHT - 26, size: 9, font: fonts.regular, color: rgb(0.7, 0.7, 0.7),
  });

  // Footer
  page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_WIDTH - MARGIN, y: 30 }, thickness: 0.5, color: LIGHT_GRAY });
  page.drawText("Simon Express Logistics LLC  ·  PO Box 1582, Riverton, UT 84065  ·  801-260-7010  ·  MC# 1003278", {
    x: MARGIN, y: 16, size: 7, font: fonts.regular, color: GRAY,
  });
  if (totalPages) {
    page.drawText(`Page ${pageNum} of ${totalPages}`, {
      x: PAGE_WIDTH - MARGIN - 60, y: 16, size: 7, font: fonts.regular, color: GRAY,
    });
  }

  return { page, y: PAGE_HEIGHT - 60 };
}

// ─── Helper: draw a section header ────────────────────────────────────────
function drawSectionHeader(page: PDFPage, fonts: Fonts, y: number, title: string): number {
  page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 20, color: LIGHT_GRAY });
  page.drawText(title.toUpperCase(), { x: MARGIN + 6, y: y + 3, size: 8, font: fonts.bold, color: GRAY });
  return y - 26;
}

// ─── Helper: draw a labeled field ─────────────────────────────────────────
function drawField(page: PDFPage, fonts: Fonts, x: number, y: number, label: string, value: string, width = 240): number {
  page.drawText(label, { x, y, size: 7, font: fonts.bold, color: GRAY });
  page.drawText(value || "—", { x, y: y - 12, size: 9, font: fonts.regular, color: BLACK });
  return y - 26;
}

// ─── Helper: wrap long text ────────────────────────────────────────────────
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Helper: draw wrapped paragraph ───────────────────────────────────────
function drawParagraph(page: PDFPage, fonts: Fonts, x: number, y: number, text: string, size = 8.5, maxWidth = CONTENT_WIDTH, bold = false): number {
  const lines = wrapText(text, bold ? fonts.bold : fonts.regular, size, maxWidth);
  for (const line of lines) {
    page.drawText(line, { x, y, size, font: bold ? fonts.bold : fonts.regular, color: BLACK });
    y -= size + 3;
  }
  return y;
}

// ─── Helper: check if we need a new page ──────────────────────────────────
function checkPageBreak(doc: PDFDocument, fonts: Fonts, page: PDFPage, y: number, needed: number, pageCounter: { n: number }): { page: PDFPage; y: number } {
  if (y - needed < 50) {
    pageCounter.n++;
    return addPage(doc, fonts, pageCounter.n);
  }
  return { page, y };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1: CARRIER PROFILE
// ═══════════════════════════════════════════════════════════════════════════
function buildCarrierProfilePage(
  doc: PDFDocument,
  fonts: Fonts,
  data: Record<string, unknown>,
  pageCounter: { n: number }
) {
  pageCounter.n++;
  const { page, y: startY } = addPage(doc, fonts, pageCounter.n);
  let y = startY;

  // Title
  page.drawText("CARRIER PROFILE", { x: MARGIN, y, size: 18, font: fonts.bold, color: BLACK });
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 2, color: RED });
  y -= 20;

  const company = (data.companyData || {}) as Record<string, string>;
  const fmcsa = (data.fmcsaData || {}) as Record<string, string>;
  const name = company.legalName || fmcsa.name || "—";
  const mc = company.mc || fmcsa.mc || "—";
  const dot = company.dot || fmcsa.dot || "—";

  // Company name large
  page.drawText(name, { x: MARGIN, y, size: 14, font: fonts.bold, color: BLACK });
  y -= 20;
  if (company.dba) {
    page.drawText(`DBA: ${company.dba}`, { x: MARGIN, y, size: 9, font: fonts.regular, color: GRAY });
    y -= 18;
  }
  y -= 6;

  // ── Company Info section ──
  y = drawSectionHeader(page, fonts, y, "Company Information");
  // Row 1
  drawField(page, fonts, MARGIN, y, "Legal Name", name, 300);
  drawField(page, fonts, MARGIN + 300, y, "EIN / Tax ID", company.ein || "—", 200);
  y -= 28;
  // Row 2
  drawField(page, fonts, MARGIN, y, "MC Number", mc, 150);
  drawField(page, fonts, MARGIN + 160, y, "DOT Number", dot, 150);
  drawField(page, fonts, MARGIN + 320, y, "Carrier Type", company.type || "Motor Carrier", 150);
  y -= 28;
  // Row 3
  drawField(page, fonts, MARGIN, y, "Trucks", company.truckCount || "—", 120);
  drawField(page, fonts, MARGIN + 130, y, "Trailers", company.trailerCount || "—", 120);

  // Trailer types
  const tt = company.trailerTypes as unknown as Record<string, boolean> || {};
  const trailerList = [tt.reefer && "Reefer", tt.van && "Dry Van", tt.flatbed && "Flatbed"].filter(Boolean).join(", ") || "—";
  drawField(page, fonts, MARGIN + 260, y, "Trailer Types", trailerList, 250);
  y -= 36;

  // ── Address ──
  y = drawSectionHeader(page, fonts, y, "Address");
  drawField(page, fonts, MARGIN, y, "Physical Address", `${company.address || "—"}, ${company.city || ""}, ${company.state || ""} ${company.zip || ""}`.trim(), 400);
  y -= 28;
  if (company.mailing) {
    const m = company.mailing as unknown as Record<string, string>;
    drawField(page, fonts, MARGIN, y, "Mailing Address", `${m.address || ""}, ${m.city || ""}, ${m.state || ""} ${m.zip || ""}`.trim(), 400);
    y -= 28;
  }
  y -= 6;

  // ── Primary Contact ──
  y = drawSectionHeader(page, fonts, y, "Primary Contact");
  drawField(page, fonts, MARGIN, y, "Contact Name", company.contactName || "—", 200);
  drawField(page, fonts, MARGIN + 210, y, "Title", company.contactTitle || "—", 150);
  y -= 28;
  drawField(page, fonts, MARGIN, y, "Phone", company.phone || fmcsa.phone || "—", 200);
  drawField(page, fonts, MARGIN + 210, y, "Email", company.email || fmcsa.email || "—", 300);
  y -= 36;

  // ── Dispatch Contact ──
  const dispatch = company.dispatch as unknown as Record<string, string> || {};
  if (dispatch.name) {
    y = drawSectionHeader(page, fonts, y, "Dispatch Contact");
    drawField(page, fonts, MARGIN, y, "Contact Name", dispatch.name || "—", 200);
    drawField(page, fonts, MARGIN + 210, y, "Title", dispatch.title || "—", 150);
    y -= 28;
    drawField(page, fonts, MARGIN, y, "Phone", dispatch.phone || "—", 200);
    drawField(page, fonts, MARGIN + 210, y, "Email", dispatch.email || "—", 300);
    y -= 36;
  }

  // ── Billing Contact ──
  const billing = company.billing as unknown as Record<string, string> || {};
  if (billing.name) {
    y = drawSectionHeader(page, fonts, y, "Billing Contact");
    drawField(page, fonts, MARGIN, y, "Contact Name", billing.name || "—", 200);
    drawField(page, fonts, MARGIN + 210, y, "Title", billing.title || "—", 150);
    y -= 28;
    drawField(page, fonts, MARGIN, y, "Phone", billing.phone || "—", 200);
    drawField(page, fonts, MARGIN + 210, y, "Email", billing.email || "—", 300);
    y -= 36;
  }

  // ── Payment / Factoring ──
  y = drawSectionHeader(page, fonts, y, "Payment Preferences");

  // Factoring
  const factoringBox = company.usesFactoring ? RED : LIGHT_GRAY;
  const factoringText = company.usesFactoring ? "YES" : "NO";
  page.drawRectangle({ x: MARGIN, y: y - 14, width: 40, height: 16, color: factoringBox, borderColor: BLACK, borderWidth: 0.5 });
  page.drawText(factoringText, { x: MARGIN + 10, y: y - 9, size: 8, font: fonts.bold, color: company.usesFactoring ? WHITE : GRAY });
  page.drawText("Uses Factoring Company", { x: MARGIN + 48, y: y - 7, size: 9, font: fonts.regular, color: BLACK });
  if (company.usesFactoring && company.factoringName) {
    page.drawText(`Company: ${company.factoringName}`, { x: MARGIN + 48, y: y - 19, size: 8, font: fonts.regular, color: GRAY });
    y -= 12;
  }
  y -= 30;

  // Quick Pay
  const qpBox = company.wantsQuickPay ? GREEN : LIGHT_GRAY;
  const qpText = company.wantsQuickPay ? "YES" : "NO";
  page.drawRectangle({ x: MARGIN, y: y - 14, width: 40, height: 16, color: qpBox, borderColor: BLACK, borderWidth: 0.5 });
  page.drawText(qpText, { x: MARGIN + 10, y: y - 9, size: 8, font: fonts.bold, color: company.wantsQuickPay ? WHITE : GRAY });
  page.drawText("Enrolled in Quick Pay (5% fee, paid within 5 days or following Wednesday)", {
    x: MARGIN + 48, y: y - 7, size: 9, font: fonts.regular, color: BLACK,
  });
  y -= 36;

  // ── Documents submitted ──
  y = drawSectionHeader(page, fonts, y, "Documents Submitted");
  const docs = (data.docsData || {}) as Record<string, unknown>;
  const uploads = (docs.uploads || {}) as Record<string, string>;
  const docRows = [
    ["W-9", docs.w9Mode === "fill" ? "Filled online" : uploads.w9 ? `Uploaded: ${uploads.w9}` : "Not provided"],
    ["Certificate of Insurance", uploads.ins ? `Uploaded: ${uploads.ins}` : docs.emailSent ? `Agent notified: ${docs.agentEmail}` : "Not provided"],
    ["Authority Letter", uploads.auth || "Not provided"],
    ["Factoring Letter", uploads.factoring || "Not provided"],
    ["Voided Check / ACH", uploads.check || "Not provided"],
  ];
  for (const [label, val] of docRows) {
    drawField(page, fonts, MARGIN, y, label as string, val as string, CONTENT_WIDTH);
    y -= 24;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2: WORKERS COMPENSATION
// ═══════════════════════════════════════════════════════════════════════════
async function buildWorkersCompPage(
  doc: PDFDocument,
  fonts: Fonts,
  data: Record<string, unknown>,
  pageCounter: { n: number }
) {
  pageCounter.n++;
  const { page, y: startY } = addPage(doc, fonts, pageCounter.n);
  let y = startY;

  const wc = (data.wcData || {}) as Record<string, unknown>;
  const company = (data.companyData || data.fmcsaData || {}) as Record<string, string>;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  page.drawText("WORKERS COMPENSATION", { x: MARGIN, y, size: 18, font: fonts.bold, color: BLACK });
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 2, color: RED });
  y -= 24;

  if (wc.hasWC) {
    // Has WC insurance
    page.drawRectangle({ x: MARGIN, y: y - 50, width: CONTENT_WIDTH, height: 60, color: rgb(0.93, 0.98, 0.95), borderColor: GREEN, borderWidth: 1 });
    page.drawText("✓ WORKERS' COMPENSATION INSURANCE ON FILE", { x: MARGIN + 12, y: y - 16, size: 12, font: fonts.bold, color: GREEN });
    page.drawText(`Carrier has confirmed active workers' compensation insurance coverage.`, { x: MARGIN + 12, y: y - 32, size: 9, font: fonts.regular, color: BLACK });
    if (wc.wcUpload) {
      page.drawText(`Certificate uploaded: ${wc.wcUpload}`, { x: MARGIN + 12, y: y - 46, size: 8, font: fonts.regular, color: GRAY });
    }
    y -= 72;
  } else {
    // Exemption form
    page.drawText("WORKERS' COMPENSATION EXEMPTION DECLARATION", { x: MARGIN, y, size: 12, font: fonts.bold, color: BLACK });
    y -= 20;

    // Carrier info box
    page.drawRectangle({ x: MARGIN, y: y - 62, width: CONTENT_WIDTH, height: 70, color: LIGHT_GRAY, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 });
    page.drawText("CARRIER INFORMATION", { x: MARGIN + 10, y: y - 14, size: 7, font: fonts.bold, color: GRAY });
    page.drawText(company.legalName || company.name || "—", { x: MARGIN + 10, y: y - 26, size: 10, font: fonts.bold, color: BLACK });
    page.drawText(`${company.address || ""}, ${company.city || ""}, ${company.state || ""} ${company.zip || ""}`.trim(), { x: MARGIN + 10, y: y - 38, size: 8.5, font: fonts.regular, color: BLACK });
    const mcDot = [company.mc ? `MC# ${company.mc}` : "", company.dot ? `DOT# ${company.dot}` : ""].filter(Boolean).join("   |   ");
    if (mcDot) page.drawText(mcDot, { x: MARGIN + 10, y: y - 52, size: 8, font: fonts.regular, color: GRAY });
    y -= 82;

    // Declaration text
    const declaration = [
      "I/We hereby declare that the carrier named herein is exempt from the workers' compensation insurance",
      "requirements under the applicable state statutes for the following reason(s):",
    ];
    for (const line of declaration) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: fonts.regular, color: BLACK });
      y -= 13;
    }
    y -= 6;

    // Checkboxes
    for (const item of [
      "Sole proprietor with no employees",
      "All workers are independent contractors",
      "Other statutory exemption",
    ]) {
      page.drawRectangle({ x: MARGIN, y: y - 10, width: 10, height: 10, borderColor: BLACK, borderWidth: 1 });
      page.drawText(item, { x: MARGIN + 16, y: y - 8, size: 9, font: fonts.regular, color: BLACK });
      y -= 18;
    }
    y -= 10;

    // Certification text
    const cert = "I understand that by signing this form, I am certifying the accuracy of this information and agree to notify Simon Express immediately if my workers' compensation status changes. I further agree to indemnify and hold harmless Simon Express from any claims arising from this exemption declaration.";
    y = drawParagraph(page, fonts, MARGIN, y, cert, 8.5);
    y -= 20;

    // Signature block
    page.drawLine({ start: { x: MARGIN, y: y + 5 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 5 }, thickness: 0.5, color: LIGHT_GRAY });
    y -= 4;

    page.drawText("CARRIER SIGNATURE", { x: MARGIN, y, size: 7, font: fonts.bold, color: GRAY });
    page.drawText("DATE", { x: MARGIN + 320, y, size: 7, font: fonts.bold, color: GRAY });
    y -= 20;

    // Embed drawn signature image if available, otherwise use typed name in large text
    const wcSigImage = wc.signatureImage as string | undefined;
    if (wcSigImage) {
      try {
        const base64Data = wcSigImage.replace(/^data:image\/png;base64,/, "");
        const pngBytes = Buffer.from(base64Data, "base64");
        const embeddedSig = await doc.embedPng(pngBytes);
        const sigDims = embeddedSig.scale(Math.min(260 / embeddedSig.width, 60 / embeddedSig.height));
        page.drawImage(embeddedSig, { x: MARGIN, y: y - sigDims.height + 14, width: sigDims.width, height: sigDims.height });
        y -= Math.max(sigDims.height, 20);
      } catch {
        if (wc.signerName) page.drawText(String(wc.signerName), { x: MARGIN, y, size: 20, font: fonts.bold, color: BLACK });
        y -= 24;
      }
    } else if (wc.signerName) {
      page.drawText(String(wc.signerName), { x: MARGIN, y, size: 20, font: fonts.bold, color: BLACK });
      y -= 24;
    }

    page.drawText(today, { x: MARGIN + 320, y: y + 10, size: 11, font: fonts.regular, color: BLACK });
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 280, y }, thickness: 0.75, color: BLACK });
    page.drawLine({ start: { x: MARGIN + 320, y }, end: { x: MARGIN + 450, y }, thickness: 0.75, color: BLACK });
    y -= 14;

    page.drawText("Printed Name:", { x: MARGIN, y, size: 7, font: fonts.bold, color: GRAY });
    page.drawText(String(wc.signerName || "—"), { x: MARGIN + 60, y, size: 8.5, font: fonts.regular, color: BLACK });
    y -= 20;

    // IP address if captured
    if (data.ipAddress) {
      const geo = (data.geoInfo || {}) as Record<string, string>;
      const geoStr = geo.city ? `  ·  ${[geo.city, geo.region].filter(Boolean).join(", ")}` : "";
      const ispStr = geo.isp ? `  ·  ISP: ${geo.isp}` : "";
      page.drawText(`Electronic signature executed from IP: ${data.ipAddress}${geoStr}${ispStr}  ·  ${today}`, {
        x: MARGIN, y, size: 7.5, font: fonts.regular, color: GRAY,
      });
      y -= 14;
    }
    page.drawText("By signing, the signer agrees that this electronic signature is legally binding.", {
      x: MARGIN, y, size: 7.5, font: fonts.regular, color: GRAY,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGES 3+: CARRIER AGREEMENT
// ═══════════════════════════════════════════════════════════════════════════
async function buildAgreementPages(
  doc: PDFDocument,
  fonts: Fonts,
  data: Record<string, unknown>,
  pageCounter: { n: number }
) {
  pageCounter.n++;
  let { page, y } = addPage(doc, fonts, pageCounter.n);

  const sig = (data.sigData || {}) as Record<string, unknown>;
  const company = (data.companyData || data.fmcsaData || {}) as Record<string, string>;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const carrierName = company.legalName || company.name || "________________________";
  const carrierMC = company.mc || "____________";
  const carrierAddr = [company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "________________________";

  // ── Title ──────────────────────────────────────────────────────────────
  page.drawText("BROKER-CARRIER TRANSPORTATION SERVICES AGREEMENT", {
    x: PAGE_WIDTH / 2, y, size: 12, font: fonts.bold, color: BLACK,
    options: { align: "center" } as never,
  });
  // Center manually
  const titleW = fonts.bold.widthOfTextAtSize("BROKER-CARRIER TRANSPORTATION SERVICES AGREEMENT", 12);
  page.drawLine({ start: { x: (PAGE_WIDTH - titleW) / 2, y: y - 2 }, end: { x: (PAGE_WIDTH + titleW) / 2, y: y - 2 }, thickness: 0.5, color: BLACK });
  y -= 20;

  // ── Opening paragraph ──────────────────────────────────────────────────
  const opening = `THIS AGREEMENT is made and entered into on ${today}, by and between Simon Express Logistics LLC ("BROKER") PO Box 1582, Riverton, Utah 84065. (MC# 077997-B) and`;
  y = drawParagraph(page, fonts, MARGIN, y, opening, 9);
  y -= 10;

  // Carrier name line
  page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: MARGIN + 200, y: y + 2 }, thickness: 0.75, color: BLACK });
  page.drawText(carrierName, { x: MARGIN + 2, y: y + 4, size: 9, font: fonts.bold, color: BLACK });
  page.drawText('("CARRIER"), (a', { x: MARGIN + 210, y: y + 4, size: 9, font: fonts.regular, color: BLACK });
  page.drawLine({ start: { x: MARGIN + 275, y: y + 2 }, end: { x: MARGIN + 380, y: y + 2 }, thickness: 0.75, color: BLACK });
  page.drawText('corporation), ("MC#', { x: MARGIN + 385, y: y + 4, size: 9, font: fonts.regular, color: BLACK });
  page.drawText(carrierMC, { x: MARGIN + 462, y: y + 4, size: 9, font: fonts.bold, color: BLACK });
  page.drawText('"),', { x: MARGIN + 500, y: y + 4, size: 9, font: fonts.regular, color: BLACK });
  y -= 20;

  page.drawText("with principal offices located at:", { x: MARGIN, y, size: 9, font: fonts.regular, color: BLACK });
  y -= 14;
  page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 2 }, thickness: 0.75, color: BLACK });
  page.drawText(carrierAddr, { x: MARGIN + 2, y: y + 4, size: 9, font: fonts.bold, color: BLACK });
  y -= 22;

  // ── Section I - Recitals ───────────────────────────────────────────────
  ({ page, y } = checkPageBreak(doc, fonts, page, y, 80, pageCounter));
  page.drawText("I.", { x: MARGIN, y, size: 10, font: fonts.bold, color: BLACK });
  y -= 14;
  page.drawText("Recitals", { x: MARGIN, y, size: 10, font: fonts.bold, color: BLACK });
  page.drawLine({ start: { x: MARGIN, y: y - 1 }, end: { x: MARGIN + 50, y: y - 1 }, thickness: 0.5, color: BLACK });
  y -= 16;

  y = drawParagraph(page, fonts, MARGIN, y,
    "A.\t\tBROKER is a licensed transportation broker that controls the transportation of freight under its contractual arrangements with various consignors and consignees (the \"Customer\");", 9, CONTENT_WIDTH);
  y -= 10;
  y = drawParagraph(page, fonts, MARGIN, y,
    "B.\t\tCARRIER is authorized to operate in inter-provincial, interstate and/or intrastate commerce and is qualified, competent and available to provide for the transportation services required by BROKER.", 9, CONTENT_WIDTH);
  y -= 18;

  // ── Section II - Agreement ─────────────────────────────────────────────
  page.drawText("II.", { x: MARGIN, y, size: 10, font: fonts.bold, color: BLACK });
  y -= 14;
  page.drawText("Agreement", { x: MARGIN, y, size: 10, font: fonts.bold, color: BLACK });
  page.drawLine({ start: { x: MARGIN, y: y - 1 }, end: { x: MARGIN + 58, y: y - 1 }, thickness: 0.5, color: BLACK });
  y -= 18;

  // ── Detailed clauses matching the uploaded document ────────────────────
  const clauses: [string, string][] = [
    ["1.\t\tTERM.", "The Term of this Agreement shall be for one (1) year and shall automatically renew for successive one (1) year periods; provided, however, that this Agreement may be terminated at any time by giving thirty (30) days prior written notice."],
    ["2.\t\tCARRIER'S OPERATING AUTHORITY AND COMPLIANCE WITH LAW.", "CARRIER represents and warrants that it is duly and legally qualified to provide, as a contract carrier, the transportation services contemplated herein. CARRIER further represents and warrants that it does have a conditional or unsatisfactory safety rating issued from the United States Department of Transportation (\"DOT\"), and further agrees to notify BROKER within twenty-four (24) hours of receiving a conditional or unsatisfactory Safety Rating from the DOT. In the event that CARRIER is requested by BROKER to transport any shipment required by the DOT to be placarded as a hazardous material, the parties agree that the additional provisions included in Appendix A shall apply for each such shipment."],
    ["3.\t\tPERFORMANCE OF SERVICES.", "Carrier's services under this Agreement are specifically designed to meet the distinct needs of BROKER under the specified rates and conditions set forth herein. CARRIER shall transport all shipments provided under this Agreement without delay, and all occurrences which would be probable or certain to cause delay shall be immediately communicated to BROKER by CARRIER. This Agreement does not grant CARRIER an exclusive right to perform the transportation related serviced for BROKER or its Customer."],
    ["4.\t\tRECEIPTS AND BILLS OF LADING.", "Each shipment hereunder shall be evidenced by a Uniform (Standard) Bill of Lading naming CARRIER as the transporting carrier. When picking up a load at a shipper's facility, CARRIER shall instruct its drivers to obtain the correct bill of lading showing CARRIER as the carrier. If it is not, CARRIER shall, or will instruct its drivers to mark out BROKERS's name on any bill of lading and to write in CARRIER's name as the motor carrier of record for the delivery. Regardless of whether the BROKER nor the services provided by the BROKER. Upon delivery of each shipment made hereunder, CARRIER shall obtain a receipt showing the kind and quantity of product delivered to the consignee of such shipment at the destination specified by BROKER or the Customer, and CARRIER shall cause such receipt to be signed by the consignee or its agent. If for any reason any consignee refuses to sign for the shipment, CARRIER shall report the same to BROKER immediately. CARRIER shall immediately forward freight bills together with any proof of delivery to BROKER."],
    ["5.\t\tRATES AND ACCESSORIALS.", "Rates are established by separate Rate Confirmation Sheet for each and every load. All rate quotes are the result of arm's length negotiations between BROKER and CARRIER and are not established through any rate bureau. Any accessorial charges not agreed to prior to loading will not be recognized or paid by the BROKER. The Rate Confirmation Sheet is incorporated into and made a part of this Agreement."],
    ["6.\t\tINVOICING AND PAYMENT.", "CARRIER will charge and BROKER will pay for transportation services at the rates shown on separate Rate Confirmation Sheets to be signed before each shipment. Standard payment terms are net thirty (30) days within receipt by BROKER. CARRIER agrees that BROKER has the exclusive right to handle all billing of freight charges to the Customer, and CARRIER agrees to refrain from all collection efforts against the shipper, receiver, consignor, consignee or Customer. If CARRIER uses a factoring company or assigns its receivables, CARRIER must notify BROKER in writing. BROKER will not be bound by any such assignment unless properly notified."],
    ["7.\t\tINDEPENDENT CONTRACTOR.", "CARRIER is an independent contractor and is not an employee, partner, or joint venturer of BROKER. CARRIER shall be solely responsible for the manner in which it performs its duties hereunder. CARRIER shall be solely responsible for the payment of all federal, state and local taxes owed in connection with compensation paid under this Agreement, and shall make all withholding and payment of employment taxes for its employees. CARRIER represents that it has worker's compensation insurance as required by applicable law or qualifies for an exemption."],
    ["8.\t\tINSURANCE.", "CARRIER shall procure and maintain, at its sole cost and expense, the following insurance coverages with insurers with a minimum A.M. Best rating of A-: (a) Automobile liability insurance in an amount not less than $1,000,000.00 per occurrence; (b) All-risk broad-form Motor Truck Cargo Legal Liability insurance in an amount not less than $100,000.00 per occurrence; (c) Statutory Workers' Compensation Insurance and Employer Liability coverage as required by applicable state law; (d) General Liability insurance in an amount not less than $1,000,000.00 per occurrence. CARRIER shall name BROKER as an additional insured on automobile liability; as loss payee on cargo legal liability. CARRIER shall provide BROKER with certificates of insurance evidencing required coverage and shall provide at least thirty (30) days prior written notice of cancellation or material modification."],
    ["9.\t\tCARGO LIABILITY.", "CARRIER shall have the sole and exclusive care, custody and control of Customer's property from pickup until delivery. CARRIER assumes the liability of a common carrier for loss, delay, damage to or destruction of any and all Customer's goods or property while in CARRIER's care, custody or control. CARRIER's liability shall be the actual loss or injury to the freight, not to exceed the invoice value of the goods. CARRIER shall pay to BROKER or allow BROKER to deduct, the Customer's full actual loss. Payments by CARRIER to BROKER shall be made within thirty (30) days following receipt of BROKER's written claim and supporting documentation."],
    ["10.\t\tWAIVER OF LIEN.", "CARRIER shall not withhold delivery of any goods of Customer on account of any dispute as to rates or any alleged failure of BROKER to pay charges. CARRIER hereby waives and releases all liens which CARRIER might otherwise have to any goods of BROKER or its Customer in its possession or control."],
    ["11.\t\tINDEMNIFICATION.", "CARRIER shall defend, indemnify, and hold harmless BROKER and its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs and expenses, including reasonable attorneys' fees, arising out of or resulting from: (a) any negligent or wrongful act or omission of CARRIER, its employees, agents, or subcontractors; (b) any breach by CARRIER of any provision of this Agreement; (c) any violation by CARRIER of any applicable federal, state or local law, rule or regulation; or (d) any claims by CARRIER's employees for wages, benefits, taxes, or similar items."],
    ["12.\t\tCONFIDENTIALITY AND NON-SOLICITATION.", "CARRIER agrees to keep confidential and not disclose to any third party any information regarding BROKER's customers, shippers, rates, lanes, and business operations. CARRIER shall not directly solicit or accept freight from any shipper or consignee that was introduced to CARRIER through BROKER for a period of twelve (12) months following the termination of this Agreement. In the event of breach, CARRIER shall pay BROKER a commission of thirty-five percent (35%) of the gross revenue generated from such traffic for a period of fifteen (15) months."],
    ["13.\t\tSUBCONTRACTING.", "CARRIER shall not subcontract, broker, or co-broker any shipment tendered to it by BROKER without the prior written consent of BROKER. Any unauthorized subcontracting shall be a material breach of this Agreement. CARRIER shall be responsible for the acts and omissions of any subcontractor as if they were CARRIER's own."],
    ["14.\t\tDRUG AND ALCOHOL TESTING.", "CARRIER represents and warrants that it has in effect a drug and alcohol testing program that meets or exceeds the requirements of 49 C.F.R. Part 382 for all drivers used to perform services under this Agreement. Upon request, CARRIER shall provide BROKER with documentation evidencing compliance with applicable DOT drug and alcohol testing regulations."],
    ["15.\t\tCOMPLIANCE WITH LAWS.", "CARRIER shall comply with all federal, state and local laws, regulations, rules and ordinances applicable to the transportation services to be performed hereunder, including without limitation, the Federal Motor Carrier Safety Regulations (49 C.F.R. Parts 300-399), hours of service regulations, vehicle safety regulations, and all applicable environmental laws and regulations."],
    ["16.\t\tASSIGNMENT.", "This Agreement may not be assigned or transferred, in whole or in part, by either party without the prior written consent of the other party. Any attempted assignment in violation of this section shall be null and void and of no force or effect."],
    ["17.\t\tSEVERABILITY.", "In the event that any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect. The invalid or unenforceable provision shall be modified to the minimum extent necessary to make it valid and enforceable."],
    ["18.\t\tWAIVER.", "The failure of either party to enforce any provision of this Agreement shall not be construed as a waiver of that party's right to enforce such provision in the future. CARRIER and BROKER expressly waive any and all rights and remedies to the extent they conflict with this Agreement, including those under 49 U.S.C. § 14101."],
    ["19.\t\tENTIRE AGREEMENT AND MODIFICATION.", "This Agreement, together with all Rate Confirmation Sheets issued pursuant hereto, constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements, representations and understandings. This Agreement may only be modified by a written instrument signed by authorized representatives of both parties."],
    ["20.\t\tGOVERNING LAW AND DISPUTE RESOLUTION.", "This Agreement shall be governed by and construed in accordance with the laws of the State of Utah, without regard to its conflict of law principles. Any dispute arising under or related to this Agreement shall be resolved in the state or federal courts located in Salt Lake County, Utah, and the parties hereby consent to the personal jurisdiction of such courts."],
  ];

  for (const [title, text] of clauses) {
    const lineCount = Math.ceil(fonts.regular.widthOfTextAtSize(text, 8.5) / CONTENT_WIDTH) + 2;
    const estimated = 16 + lineCount * 12 + 14;
    ({ page, y } = checkPageBreak(doc, fonts, page, y, estimated, pageCounter));

    // Bold underlined clause title
    const cleanTitle = title.replace(/\t/g, "  ");
    page.drawText(cleanTitle, { x: MARGIN, y, size: 9, font: fonts.bold, color: BLACK });
    y -= 13;
    y = drawParagraph(page, fonts, MARGIN + 16, y, text, 8.5, CONTENT_WIDTH - 16);
    y -= 10;
  }

  // ── Signature block ────────────────────────────────────────────────────
  ({ page, y } = checkPageBreak(doc, fonts, page, y, 220, pageCounter));

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: LIGHT_GRAY });
  y -= 20;

  // Two-column signature area
  const leftX = MARGIN;
  const rightX = PAGE_WIDTH / 2 + 20;

  // Headers
  page.drawText("BROKER — Simon Express Logistics LLC", { x: leftX, y, size: 9, font: fonts.bold, color: BLACK });
  page.drawText("CARRIER — " + carrierName, { x: rightX, y, size: 9, font: fonts.bold, color: BLACK });
  y -= 14;

  // Carrier address block
  const addrLines = [
    carrierAddr,
    company.phone ? `Phone: ${company.phone}` : "",
    [company.mc ? `MC# ${company.mc}` : "", company.dot ? `DOT# ${company.dot}` : ""].filter(Boolean).join("   |   "),
  ].filter(Boolean);
  for (const line of addrLines) {
    page.drawText(line, { x: rightX, y, size: 7.5, font: fonts.regular, color: GRAY });
    y -= 11;
  }
  y -= 6;

  // "By:" row with signatures
  page.drawText("By:", { x: leftX, y, size: 9, font: fonts.regular, color: GRAY });
  page.drawText("Jason Fishback", { x: leftX + 24, y, size: 11, font: fonts.bold, color: BLACK });
  page.drawText("By:", { x: rightX, y, size: 9, font: fonts.regular, color: GRAY });
  y -= 13;

  // Broker address directly under name
  page.drawText("Simon Express Logistics LLC", { x: leftX, y, size: 8, font: fonts.regular, color: GRAY });
  y -= 11;
  page.drawText("PO Box 1582, Riverton, UT 84065", { x: leftX, y, size: 8, font: fonts.regular, color: GRAY });
  y -= 11;
  page.drawText("Phone: 801-260-7010  |  Fax: 801-663-7537", { x: leftX, y, size: 8, font: fonts.regular, color: GRAY });
  y -= 8;

  // Carrier signature — embed drawn image or large typed name
  const agreementSigImage = sig.signatureImage as string | undefined;
  if (agreementSigImage) {
    try {
      const base64Data = agreementSigImage.replace(/^data:image\/png;base64,/, "");
      const pngBytes = Buffer.from(base64Data, "base64");
      const embeddedSig = await doc.embedPng(pngBytes);
      const maxW = 200;
      const maxH = 55;
      const sigDims = embeddedSig.scale(Math.min(maxW / embeddedSig.width, maxH / embeddedSig.height));
      page.drawImage(embeddedSig, { x: rightX + 20, y: y - sigDims.height + 16, width: sigDims.width, height: sigDims.height });
      y -= Math.max(sigDims.height + 4, 22);
    } catch {
      if (sig.signerName) page.drawText(String(sig.signerName), { x: rightX + 20, y, size: 20, font: fonts.bold, color: BLACK });
      y -= 26;
    }
  } else if (sig.signerName) {
    page.drawText(String(sig.signerName), { x: rightX + 20, y, size: 20, font: fonts.bold, color: BLACK });
    y -= 26;
  } else {
    y -= 26;
  }

  page.drawLine({ start: { x: leftX, y }, end: { x: leftX + 220, y }, thickness: 0.75, color: BLACK });
  page.drawLine({ start: { x: rightX, y }, end: { x: rightX + 220, y }, thickness: 0.75, color: BLACK });
  y -= 14;

  page.drawText("Title: VP of Operations", { x: leftX, y, size: 8.5, font: fonts.regular, color: BLACK });
  page.drawText(`Printed: ${String(sig.signerName || "________________________")}`, { x: rightX, y, size: 8.5, font: fonts.regular, color: BLACK });
  y -= 14;
  page.drawText(`Date: ${today}`, { x: leftX, y, size: 8.5, font: fonts.regular, color: BLACK });
  page.drawText(`Date: ${today}`, { x: rightX, y, size: 8.5, font: fonts.regular, color: BLACK });
  y -= 14;
  if (sig.signerTitle) {
    page.drawText(`Title: ${String(sig.signerTitle)}`, { x: rightX, y, size: 8.5, font: fonts.regular, color: BLACK });
  }
  y -= 20;

  // Legal notice
  if (data.ipAddress) {
    const geo = (data.geoInfo || {}) as Record<string, string>;
    const geoStr = geo.city ? `  ·  ${[geo.city, geo.region, geo.country].filter(Boolean).join(", ")}` : "";
    const ispStr = geo.isp ? `  ·  ISP: ${geo.isp}` : "";
    page.drawText(`IP Address: ${String(data.ipAddress)}${geoStr}${ispStr}  ·  Signed electronically: ${today}`, {
      x: MARGIN, y, size: 7, font: fonts.regular, color: GRAY,
    });
    y -= 11;
  }
  page.drawText("This electronic signature is legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. § 7001 et seq.).", {
    x: MARGIN, y, size: 7, font: fonts.regular, color: GRAY,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT: generateOnboardingPDF
// ═══════════════════════════════════════════════════════════════════════════
export async function generateOnboardingPDF(data: Record<string, unknown>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { regular: fontRegular, bold: fontBold };
  const pageCounter = { n: 0 };

  // Page 1: Carrier Profile
  buildCarrierProfilePage(doc, fonts, data, pageCounter);

  // Page 2: Workers Comp
  await buildWorkersCompPage(doc, fonts, data, pageCounter);

  // Pages 3+: Agreement
  await buildAgreementPages(doc, fonts, data, pageCounter);

  // Update page numbers now that we know total
  const total = doc.getPageCount();
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${total}`, {
      x: PAGE_WIDTH - MARGIN - 60,
      y: 16,
      size: 7,
      font: fontRegular,
      color: GRAY,
    });
  });

  return doc.save();
}
