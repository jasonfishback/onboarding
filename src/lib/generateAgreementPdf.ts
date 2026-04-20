// Generates a standalone carrier copy of the agreement (pages 3+ of the main packet)
// Reuses the same buildAgreementPages logic via a thin wrapper

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { generateOnboardingPDF } from "./generatePdf";

// We generate the full packet then extract from page 3 onward
export async function generateAgreementPDF(data: Record<string, unknown>): Promise<Uint8Array> {
  // Generate full packet
  const fullBytes = await generateOnboardingPDF(data);

  // Load it and copy pages 3+ into a new doc
  const fullDoc = await PDFDocument.load(fullBytes);
  const agreementDoc = await PDFDocument.create();

  const totalPages = fullDoc.getPageCount();
  // Pages 0,1 = carrier profile + WC. Pages 2+ = agreement
  const pagesToCopy = Array.from({ length: totalPages - 2 }, (_, i) => i + 2);

  if (pagesToCopy.length === 0) {
    // Fallback: just copy all pages if something is off
    const allIndices = Array.from({ length: totalPages }, (_, i) => i);
    const copied = await agreementDoc.copyPages(fullDoc, allIndices);
    copied.forEach(p => agreementDoc.addPage(p));
  } else {
    const copied = await agreementDoc.copyPages(fullDoc, pagesToCopy);
    copied.forEach(p => agreementDoc.addPage(p));
  }

  return agreementDoc.save();
}
