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
      page.drawText(`Electronic signature executed from IP address: ${data.ipAddress}  ·  ${today}`, {
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

  // Title
  page.drawText("CARRIER TRANSPORTATION AGREEMENT", { x: MARGIN, y, size: 16, font: fonts.bold, color: BLACK });
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 2, color: RED });
  y -= 18;

  // Parties header
  page.drawText("Simon Express Logistics LLC — Freight Broker", { x: MARGIN, y, size: 10, font: fonts.bold, color: BLACK });
  y -= 13;
  page.drawText("PO Box 1582, Riverton, UT 84065  ·  Phone: 801-260-7010  ·  Fax: 801-663-7537  ·  MC# 1003278", {
    x: MARGIN, y, size: 8, font: fonts.regular, color: GRAY,
  });
  y -= 22;

  const clauses = [
    ["1. INDEPENDENT CONTRACTOR", "CARRIER is an independent contractor and is not an employee, partner, or agent of BROKER. CARRIER retains complete direction and control over the means, manner, and method of transportation. CARRIER acknowledges it has no authority to legally bind or obligate BROKER in any manner."],
    ["2. REGULATORY COMPLIANCE", "CARRIER warrants that it is, and will remain, duly and legally licensed and authorized to perform transportation services pursuant to applicable federal and state laws and regulations. CARRIER will provide evidence of operating authority as requested. CARRIER shall immediately notify BROKER of any revocation or suspension of its operating authority."],
    ["3. SAFETY", "CARRIER shall comply with all federal, state and local laws, rules, ordinances and regulations applicable to the transportation of freight, including but not limited to all laws and regulations related to hours of service, driver qualification, drug and alcohol testing, vehicle safety, and hazardous materials. CARRIER certifies that all drivers assigned to BROKER freight will be properly trained, licensed, and in compliance with DOT regulations."],
    ["4. EXCLUSIVE USE OF CARRIER EQUIPMENT", "The transportation services hereunder shall be performed using equipment that is exclusively operated under CARRIER's authority, owned or leased by CARRIER, and driven by CARRIER's employees or independent contractors who are properly enrolled in CARRIER's drug testing program. CARRIER shall ensure that all equipment used meets federal and state safety requirements."],
    ["5. INDEMNIFICATION", "CARRIER shall defend, indemnify and hold harmless BROKER, its officers, directors, employees and agents from any and all claims, losses, liabilities, damages, costs and expenses (including reasonable attorney's fees) arising from or related to: (a) CARRIER's negligence or willful misconduct; (b) CARRIER's breach of this Agreement; (c) personal injury or property damage caused by CARRIER; or (d) CARRIER's failure to comply with applicable laws and regulations."],
    ["6. EXCLUSIVE CONTROL OF SHIPMENTS", "CARRIER shall not sub-contract, broker, or arrange for the freight tendered by BROKER to be transported by a third party without the prior written consent of BROKER. CARRIER agrees that BROKER has the exclusive right to handle all billing of freight charges to the Customer."],
    ["7. INSURANCE", "CARRIER shall procure and maintain, at its sole cost and expense: (a) Automobile liability insurance — not less than $1,000,000.00 per occurrence; (b) All-risk broad-form Motor Truck Cargo Legal Liability insurance — not less than $100,000.00 per occurrence, naming CARRIER and BROKER as insureds; (c) Statutory Workers' Compensation Insurance and Employer Liability coverage as required by applicable state law. CARRIER shall furnish written certifications from insurance carriers rated A- or better by A.M. Best, and shall provide at least thirty (30) days written notice of cancellation or modification. CARRIER agrees to name BROKER as an additional insured on automobile liability; as loss payee on cargo legal liability; and as alternative employer on workers' compensation."],
    ["8. CARGO LIABILITY", "CARRIER shall have the sole and exclusive care, custody and control of Customer's property from pickup until delivery. CARRIER assumes the liability of a common carrier (Carmack Amendment liability) for loss, delay, damage to or destruction of any and all Customer's goods or property while under CARRIER's care, custody or control. CARRIER shall pay to BROKER the Customer's full actual loss within thirty (30) days following receipt of BROKER's invoice and supporting documentation."],
    ["9. WAIVER OF CARRIER'S LIEN", "CARRIER shall not withhold any goods of the Customer on account of any dispute as to rates or any alleged failure of BROKER to pay charges. CARRIER hereby waives and releases all liens which CARRIER might otherwise have to any goods of BROKER or its Customer in the possession or control of CARRIER."],
    ["10. INVOICING AND PAYMENT", "CARRIER will charge and BROKER will pay for transportation services at the rates shown on separate Rate Confirmation Sheets to be signed before each shipment. Standard payment terms are thirty (30) days within receipt by BROKER unless other terms are selected. CARRIER agrees that BROKER has the exclusive right to handle all billing of freight charges to the Customer, and CARRIER agrees to refrain from all collection efforts against the shipper, receiver, consignor, consignee or Customer."],
    ["11. CONFIDENTIALITY AND NON-SOLICITATION", "Neither party may disclose the terms of this Agreement to a third party without written consent. CARRIER will not solicit or obtain traffic from any shipper, consignor, consignee, or customer of BROKER where the availability of such traffic first became known to CARRIER as a result of BROKER's efforts. If CARRIER breaches this Agreement, CARRIER shall pay BROKER commission in the amount of thirty-five percent (35%) of the transportation revenue resulting from such traffic for a period of 15 months thereafter."],
    ["12. SUB-CONTRACT PROHIBITION", "CARRIER specifically agrees that all freight tendered to it by BROKER shall be transported on equipment operated only under the authority of CARRIER, and that CARRIER shall not sub-contract, broker, or arrange for the freight to be transported by a third party without the prior written consent of BROKER. CARRIER shall defend, indemnify and hold harmless BROKER from any claims for duplicate payments claimed to be due to any sub-contractor or third party used by CARRIER."],
    ["13. ASSIGNMENT / MODIFICATION", "This Agreement may not be assigned or transferred in whole or in part, and supersedes all other agreements and all tariffs, rates, classifications and schedules published, filed or otherwise maintained by CARRIER."],
    ["14. SEVERABILITY", "In the event that the operation of any portion of this Agreement results in violation of any law, the parties agree that such portion shall be severable and that the remaining provisions shall continue in full force and effect."],
    ["15. WAIVER", "CARRIER and Shipper expressly waive any and all rights and remedies allowed under 49 U.S.C. § 14101 to the extent that such rights and remedies conflict with this Agreement. Failure of BROKER to insist upon CARRIER's performance shall not be a waiver of any BROKER's rights or privileges herein."],
    ["16. DISPUTE RESOLUTION", "This Agreement shall be deemed to have been drawn in accordance with the statutes and laws of the State of Utah and in the event of any disagreement or dispute, the laws of this state shall apply and suit must be brought in this state."],
  ];

  for (const [title, text] of clauses) {
    // Check page break
    const estimated = 30 + Math.ceil((fonts.regular.widthOfTextAtSize(text, 8.5) / CONTENT_WIDTH) * 14);
    ({ page, y } = checkPageBreak(doc, fonts, page, y, estimated, pageCounter));

    // Clause title
    page.drawText(title as string, { x: MARGIN, y, size: 9, font: fonts.bold, color: BLACK });
    y -= 13;
    y = drawParagraph(page, fonts, MARGIN, y, text as string, 8.5);
    y -= 10;
  }

  // ── Signature block — needs its own check ──
  ({ page, y } = checkPageBreak(doc, fonts, page, y, 180, pageCounter));

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: LIGHT_GRAY });
  y -= 20;

  // Two-column signature area
  const leftX = MARGIN;
  const rightX = PAGE_WIDTH / 2 + 20;

  // BROKER side (left)
  page.drawText("BROKER — Simon Express Logistics LLC", { x: leftX, y, size: 9, font: fonts.bold, color: BLACK });
  page.drawText("CARRIER — " + (company.legalName || company.name || ""), { x: rightX, y, size: 9, font: fonts.bold, color: BLACK });
  y -= 16;

  // Carrier address under their name
  const carrierAddr = [
    company.address,
    [company.city, company.state, company.zip].filter(Boolean).join(", "),
    company.phone,
  ].filter(Boolean);
  for (const line of carrierAddr) {
    page.drawText(String(line), { x: rightX, y, size: 7.5, font: fonts.regular, color: GRAY });
    y -= 11;
  }
  if (company.mc || company.dot) {
    const mcDot = [company.mc ? `MC# ${company.mc}` : "", company.dot ? `DOT# ${company.dot}` : ""].filter(Boolean).join("   |   ");
    page.drawText(mcDot, { x: rightX, y, size: 7.5, font: fonts.regular, color: GRAY });
    y -= 14;
  }

  // "By:" labels
  page.drawText("By: Jason Fishback", { x: leftX, y, size: 9, font: fonts.regular, color: BLACK });
  page.drawText("By:", { x: rightX, y, size: 9, font: fonts.regular, color: GRAY });
  y -= 4;

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
      y -= Math.max(sigDims.height + 4, 20);
    } catch {
      // fallback to typed name
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
  page.drawText("Title: Director of Operations", { x: leftX, y, size: 8.5, font: fonts.regular, color: BLACK });
  page.drawText(`Printed: ${String(sig.signerName || "—")}`, { x: rightX, y, size: 8.5, font: fonts.regular, color: BLACK });
  y -= 14;
  page.drawText(`Date: ${today}`, { x: leftX, y, size: 8.5, font: fonts.regular, color: BLACK });
  page.drawText(`Date: ${today}`, { x: rightX, y, size: 8.5, font: fonts.regular, color: BLACK });
  y -= 14;
  if (sig.signerTitle) {
    page.drawText(`Title: ${String(sig.signerTitle)}`, { x: rightX, y, size: 8.5, font: fonts.regular, color: BLACK });
    y -= 14;
  }

  y -= 10;
  // IP + legal notice
  if (data.ipAddress) {
    page.drawText(`IP Address: ${String(data.ipAddress)}  ·  Signed: ${today}`, {
      x: MARGIN, y, size: 7.5, font: fonts.regular, color: GRAY,
    });
    y -= 12;
  }
  page.drawText("This electronic signature is legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act).", {
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
