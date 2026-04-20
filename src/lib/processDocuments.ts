import sharp from "sharp";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const BLACK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.5, 0.5, 0.5);
const LIGHT_GRAY = rgb(0.93, 0.93, 0.93);
const WHITE = rgb(1, 1, 1);
const RED = rgb(0.8, 0.106, 0.106);

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ── Process a single image buffer: grayscale, auto-level, compress ──────────
async function processImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  let pipeline = sharp(buffer);

  // Convert PDF pages to image if needed (handled separately)
  // For images: grayscale, normalize (auto-levels like CamScanner), sharpen, compress
  pipeline = pipeline
    .grayscale()                    // Convert to grayscale
    .normalize()                    // Auto-level (boost contrast like CamScanner)
    .sharpen({ sigma: 0.8 })        // Slight sharpen for scanned look
    .trim({ threshold: 20 })        // Auto-crop white/light borders
    .jpeg({ quality: 72, progressive: true });  // Compress to JPEG

  return pipeline.toBuffer();
}

// ── Get image dimensions after processing ──────────────────────────────────
async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  return { width: meta.width || 800, height: meta.height || 600 };
}

// ── Fit image into page dimensions maintaining aspect ratio ────────────────
function fitToPage(imgW: number, imgH: number, maxW: number, maxH: number): { w: number; h: number } {
  const ratio = Math.min(maxW / imgW, maxH / imgH);
  return { w: Math.floor(imgW * ratio), h: Math.floor(imgH * ratio) };
}

export interface UploadedFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
  label: string; // e.g. "Certificate of Insurance", "W-9"
}

// ── Build the full attachments PDF ─────────────────────────────────────────
export async function buildAttachmentsPdf(files: UploadedFile[], companyName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── Cover page ──────────────────────────────────────────────────────────
  const cover = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cover.drawRectangle({ x: 0, y: PAGE_HEIGHT - 50, width: PAGE_WIDTH, height: 50, color: BLACK });
  cover.drawText("SIMON EXPRESS LOGISTICS LLC", { x: MARGIN, y: PAGE_HEIGHT - 30, size: 13, font: fontBold, color: WHITE });
  cover.drawText("Carrier Document Attachments", { x: MARGIN, y: PAGE_HEIGHT - 46, size: 9, font: fontReg, color: rgb(0.7, 0.7, 0.7) });

  // Title
  cover.drawText("SUPPORTING DOCUMENTS", { x: MARGIN, y: PAGE_HEIGHT - 100, size: 22, font: fontBold, color: BLACK });
  cover.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 112 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 112 }, thickness: 2, color: RED });

  cover.drawText(companyName, { x: MARGIN, y: PAGE_HEIGHT - 140, size: 14, font: fontBold, color: BLACK });
  cover.drawText(`Generated: ${today}`, { x: MARGIN, y: PAGE_HEIGHT - 158, size: 10, font: fontReg, color: GRAY });

  // Table of contents
  cover.drawText("DOCUMENTS INCLUDED", { x: MARGIN, y: PAGE_HEIGHT - 200, size: 9, font: fontBold, color: GRAY });
  let tocY = PAGE_HEIGHT - 220;
  files.forEach((f, i) => {
    cover.drawText(`${i + 1}.`, { x: MARGIN, y: tocY, size: 10, font: fontBold, color: BLACK });
    cover.drawText(f.label, { x: MARGIN + 20, y: tocY, size: 10, font: fontReg, color: BLACK });
    cover.drawText(f.name, { x: MARGIN + 20, y: tocY - 12, size: 8, font: fontReg, color: GRAY });
    tocY -= 32;
  });

  // Footer
  cover.drawText("Simon Express Logistics LLC  ·  PO Box 1582, Riverton, UT 84065  ·  801-260-7010", {
    x: MARGIN, y: 20, size: 7, font: fontReg, color: GRAY,
  });

  let pageNum = 1;

  // ── Process each file ───────────────────────────────────────────────────
  for (const file of files) {
    pageNum++;
    const { name, mimeType, buffer, label } = file;

    // ── PDF files: merge pages directly ──────────────────────────────────
    if (mimeType === "application/pdf") {
      try {
        const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const srcPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices());

        for (let pi = 0; pi < srcPages.length; pi++) {
          const srcPage = srcPages[pi];
          // Scale down to fit Letter if needed
          const { width: sw, height: sh } = srcPage.getSize();
          const scale = Math.min(PAGE_WIDTH / sw, PAGE_HEIGHT / sh, 1);

          const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

          // Header
          newPage.drawRectangle({ x: 0, y: PAGE_HEIGHT - 32, width: PAGE_WIDTH, height: 32, color: BLACK });
          newPage.drawText(`SIMON EXPRESS  ·  ${label.toUpperCase()}`, { x: MARGIN, y: PAGE_HEIGHT - 20, size: 9, font: fontBold, color: WHITE });
          newPage.drawText(pi === 0 ? name : `${name} (cont.)`, { x: PAGE_WIDTH - MARGIN - 180, y: PAGE_HEIGHT - 20, size: 7, font: fontReg, color: rgb(0.6, 0.6, 0.6) });

          // Embed the source page
          const embedded = await doc.embedPage(srcPage);
          const scaledW = sw * scale;
          const scaledH = sh * scale;
          const xOffset = (PAGE_WIDTH - scaledW) / 2;
          const yOffset = (PAGE_HEIGHT - 32 - scaledH) / 2;

          newPage.drawPage(embedded, { x: xOffset, y: yOffset, width: scaledW, height: scaledH });

          // Footer
          newPage.drawText(`${label}  ·  Page ${pi + 1} of ${srcPages.length}  ·  ${companyName}`, {
            x: MARGIN, y: 10, size: 6.5, font: fontReg, color: GRAY,
          });
        }
      } catch (err) {
        // If PDF parsing fails, add an error page
        console.error(`[docs] failed to embed PDF ${name}:`, err);
        const errPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        errPage.drawText(`Could not render: ${name}`, { x: MARGIN, y: PAGE_HEIGHT / 2, size: 12, font: fontBold, color: BLACK });
      }
      continue;
    }

    // ── Image files: process and embed ────────────────────────────────────
    try {
      // Process: grayscale + auto-level + trim + compress
      const processed = await processImage(buffer, mimeType);
      const { width: imgW, height: imgH } = await getImageDimensions(processed);

      // Available space on page (below header, above footer)
      const availH = PAGE_HEIGHT - 32 - 30; // header 32 + footer 30
      const availW = PAGE_WIDTH - MARGIN * 2;
      const { w, h } = fitToPage(imgW, imgH, availW, availH);

      const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      // Header
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 32, width: PAGE_WIDTH, height: 32, color: BLACK });
      page.drawText(`SIMON EXPRESS  ·  ${label.toUpperCase()}`, { x: MARGIN, y: PAGE_HEIGHT - 20, size: 9, font: fontBold, color: WHITE });
      page.drawText(name, { x: PAGE_WIDTH - MARGIN - 180, y: PAGE_HEIGHT - 20, size: 7, font: fontReg, color: rgb(0.6, 0.6, 0.6) });

      // Embed processed image centered on page
      const embedded = await doc.embedJpg(processed);
      const xOffset = (PAGE_WIDTH - w) / 2;
      const yOffset = 30 + (availH - h) / 2;

      page.drawImage(embedded, { x: xOffset, y: yOffset, width: w, height: h });

      // Light border around image
      page.drawRectangle({ x: xOffset - 1, y: yOffset - 1, width: w + 2, height: h + 2, borderColor: LIGHT_GRAY, borderWidth: 0.5 });

      // Footer
      page.drawText(`${label}  ·  ${companyName}  ·  ${today}`, {
        x: MARGIN, y: 10, size: 6.5, font: fontReg, color: GRAY,
      });
    } catch (err) {
      console.error(`[docs] failed to process image ${name}:`, err);
      const errPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      errPage.drawText(`Could not render: ${name}`, { x: MARGIN, y: PAGE_HEIGHT / 2, size: 12, font: fontBold, color: BLACK });
    }
  }

  // ── Page numbers on cover ───────────────────────────────────────────────
  const total = doc.getPageCount();
  cover.drawText(`${total} page${total !== 1 ? "s" : ""} total`, { x: MARGIN, y: PAGE_HEIGHT - 175, size: 9, font: fontReg, color: GRAY });

  return doc.save({
    useObjectStreams: true,  // Compress PDF structure
    addDefaultPage: false,
  });
}
