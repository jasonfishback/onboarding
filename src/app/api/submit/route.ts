import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateOnboardingPDF } from "@/lib/generatePdf";
import { buildAttachmentsPdf } from "@/lib/processDocuments";
import { getSessionFiles } from "@/app/api/upload/route";

export const runtime = "nodejs";

// ─── Email HTML builders ───────────────────────────────────────────────────
function buildDispatchEmail(data: {
  companyData: Record<string, unknown>;
  fmcsaData: Record<string, unknown> | null;
  docsData: Record<string, unknown> | null;
  wcData: Record<string, unknown> | null;
  sigData: Record<string, unknown> | null;
  ipAddress: string;
}): string {
  const { companyData, fmcsaData, docsData, wcData, sigData, ipAddress } = data;
  const name = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
  const mc = (companyData?.mc as string) || (fmcsaData?.mc as string) || "—";
  const dot = (companyData?.dot as string) || (fmcsaData?.dot as string) || "—";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const tt = (companyData?.trailerTypes as Record<string, boolean>) || {};
  const trailers = [tt.reefer && "Reefer", tt.van && "Dry Van", tt.flatbed && "Flatbed"].filter(Boolean).join(", ") || "—";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0;padding:20px}
.wrap{max-width:620px;margin:0 auto;background:white;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a}
.hdr{background:#1a1a1a;padding:24px 28px}.hdr h1{color:white;margin:0;font-size:20px}
.hdr p{color:#aaa;margin:4px 0 0;font-size:12px}
.body{padding:28px}
.pdf-note{background:#f0f6ff;border:1.5px solid #4a90e2;border-radius:2px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#333}
.sec{margin-bottom:20px;border:1.5px solid #ddd;border-radius:2px}
.sec-hdr{background:#f5f3ef;padding:8px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#555;border-bottom:1px solid #ddd}
.sec-body{padding:16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}
.f .lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:2px}
.f .val{font-size:14px;color:#222}
.badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:700}
.bg{background:#edfaf3;color:#22a355;border:1px solid #22a355}
.br{background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B}
.bn{background:#f0f0f0;color:#888;border:1px solid #ddd}
.ftr{background:#f5f3ef;border-top:1px solid #ddd;padding:16px 28px;font-size:11px;color:#888;text-align:center}
</style></head><body>
<div class="wrap">
<div class="hdr"><h1>🚛 New Carrier: ${name}</h1><p>Simon Express Onboarding — ${today}</p></div>
<div class="body">
<div class="pdf-note">📎 <strong>Two PDFs attached:</strong> (1) Onboarding Packet — carrier profile, workers comp & signed agreement &nbsp;|&nbsp; (2) Supporting Documents — all uploaded files, processed and compressed</div>

<div class="sec"><div class="sec-hdr">Company</div><div class="sec-body"><div class="grid">
<div class="f"><div class="lbl">Legal Name</div><div class="val">${name}</div></div>
<div class="f"><div class="lbl">DBA</div><div class="val">${(companyData?.dba as string) || "—"}</div></div>
<div class="f"><div class="lbl">MC #</div><div class="val">${mc}</div></div>
<div class="f"><div class="lbl">DOT #</div><div class="val">${dot}</div></div>
<div class="f"><div class="lbl">EIN</div><div class="val">${(companyData?.ein as string) || "—"}</div></div>
<div class="f"><div class="lbl">Trucks / Trailers</div><div class="val">${(companyData?.truckCount as string) || "—"} / ${(companyData?.trailerCount as string) || "—"}</div></div>
<div class="f"><div class="lbl">Trailer Types</div><div class="val">${trailers}</div></div>
<div class="f"><div class="lbl">Phone</div><div class="val">${(companyData?.phone as string) || "—"}</div></div>
<div class="f"><div class="lbl">Email</div><div class="val">${(companyData?.email as string) || "—"}</div></div>
<div class="f"><div class="lbl">Contact</div><div class="val">${(companyData?.contactName as string) || "—"}</div></div>
<div class="f"><div class="lbl">Quick Pay</div><div class="val">${companyData?.wantsQuickPay ? '<span class="badge bg">✓ Yes (5% fee)</span>' : '<span class="badge bn">No</span>'}</div></div>
<div class="f"><div class="lbl">Factoring</div><div class="val">${companyData?.usesFactoring ? `<span class="badge br">Yes — ${(companyData?.factoringName as string) || ""}</span>` : '<span class="badge bn">No</span>'}</div></div>
</div></div></div>

<div class="sec"><div class="sec-hdr">Documents & Agreement</div><div class="sec-body"><div class="grid">
<div class="f"><div class="lbl">Workers Comp</div><div class="val">${(wcData as Record<string, unknown>)?.hasWC ? "✓ Insurance on file" : "Exemption signed"}</div></div>
<div class="f"><div class="lbl">Signed By</div><div class="val">${(sigData as Record<string, unknown>)?.signerName || "—"}, ${(sigData as Record<string, unknown>)?.signerTitle || ""}</div></div>
<div class="f"><div class="lbl">Signed Date</div><div class="val">${today}</div></div>
<div class="f"><div class="lbl">IP Address</div><div class="val" style="font-family:monospace;font-size:12px">${ipAddress}</div></div>
</div></div></div>
</div>
<div class="ftr">Simon Express Logistics LLC · PO Box 1582, Riverton, UT 84065 · 801-260-7010 · MC# 1003278</div>
</div></body></html>`;
}

function buildCarrierConfirmEmail(companyName: string, today: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0;padding:20px}
.wrap{max-width:600px;margin:0 auto;background:white;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a}
.hdr{background:#1a1a1a;padding:24px 28px}.hdr h1{color:white;margin:0;font-size:20px}
.hdr p{color:#aaa;margin:4px 0 0;font-size:12px}
.body{padding:28px;font-size:15px;color:#333;line-height:1.7}
.box{background:#f5f3ef;border:1.5px solid #ddd;padding:16px 20px;margin:20px 0;border-radius:2px}
.ftr{background:#f5f3ef;border-top:1px solid #ddd;padding:16px 28px;font-size:11px;color:#888;text-align:center}
</style></head><body><div class="wrap">
<div class="hdr"><h1>✓ Application Received</h1><p>Simon Express Logistics LLC — ${today}</p></div>
<div class="body">
<p>Thank you, <strong>${companyName}</strong>!</p>
<p>We've received your carrier onboarding application. Our team will review your documents and be in touch shortly.</p>
<div class="box">
<strong>📞 Questions?</strong><br>
Call us at <strong>801-260-7010</strong><br>
Email: <a href="mailto:dispatch@simonexpress.com">dispatch@simonexpress.com</a><br>
Fax: 801-663-7537
</div>
</div>
<div class="ftr">Simon Express Logistics LLC · PO Box 1582, Riverton, UT 84065 · MC# 1003278</div>
</div></body></html>`;
}

// ─── Label map for document types ──────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  w9: "W-9 Tax Form",
  ins: "Certificate of Insurance",
  auth: "Authority Letter (MC)",
  factoring: "Factoring Letter / NOA",
  check: "Voided Check / ACH Info",
  wc: "Workers Compensation Certificate",
};

// ─── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ success: false, error: "Resend not configured" }, { status: 500 });

    const resend = new Resend(resendKey);
    const body = await req.json();
    const { fmcsaData, companyData, docsData, wcData, sigData, sessionId } = body;

    // Capture IP
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "Unknown";

    const companyName = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
    const carrierEmail = (companyData?.email as string) || "";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const FROM = process.env.FROM_EMAIL || "onboarding@simonexpress.com";
    const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 35);

    // ── 1. Generate main onboarding packet PDF ──
    console.log("[submit] generating onboarding packet PDF...");
    const packetBytes = await generateOnboardingPDF({
      companyData, fmcsaData, docsData, wcData, sigData, ipAddress,
    });
    console.log("[submit] packet PDF:", packetBytes.length, "bytes");

    // ── 2. Generate attachments PDF (uploaded docs) ──
    const attachments: Array<{ filename: string; content: string }> = [
      {
        filename: `Simon_Express_Onboarding_Packet_${safeName}.pdf`,
        content: Buffer.from(packetBytes).toString("base64"),
      },
    ];

    if (sessionId) {
      const sessionFiles = getSessionFiles(sessionId);
      if (sessionFiles && sessionFiles.size > 0) {
        console.log("[submit] processing", sessionFiles.size, "uploaded documents...");

        const uploadedFiles = Array.from(sessionFiles.entries()).map(([key, f]) => ({
          name: f.name,
          mimeType: f.mimeType,
          buffer: f.buffer,
          label: DOC_LABELS[key] || key,
        }));

        const docsPdfBytes = await buildAttachmentsPdf(uploadedFiles, companyName);
        console.log("[submit] attachments PDF:", docsPdfBytes.length, "bytes");

        attachments.push({
          filename: `Simon_Express_Documents_${safeName}.pdf`,
          content: Buffer.from(docsPdfBytes).toString("base64"),
        });
      }
    }

    // ── 3. Send to dispatch ──
    const htmlBody = buildDispatchEmail({ companyData, fmcsaData, docsData, wcData, sigData, ipAddress });
    await resend.emails.send({
      from: FROM,
      to: ["dispatch@simonexpress.com"],
      subject: `🚛 New Carrier Onboarding: ${companyName} — MC ${(companyData?.mc as string) || (fmcsaData?.mc as string) || ""}`,
      html: htmlBody,
      attachments,
    });
    console.log("[submit] dispatch email sent with", attachments.length, "PDF(s)");

    // ── 4. Send confirmation to carrier ──
    if (carrierEmail) {
      await resend.emails.send({
        from: FROM,
        to: [carrierEmail],
        subject: `✓ Simon Express — Carrier Application Received`,
        html: buildCarrierConfirmEmail(companyName, today),
      });
      console.log("[submit] carrier confirmation sent to:", carrierEmail);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[submit] error:", String(err));
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
