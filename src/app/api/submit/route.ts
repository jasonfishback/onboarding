import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateOnboardingPDF } from "@/lib/generatePdf";

export const runtime = "nodejs";

function buildEmailHtml(data: {
  companyData: Record<string, unknown>;
  fmcsaData: Record<string, unknown> | null;
  docsData: Record<string, unknown> | null;
  wcData: Record<string, unknown> | null;
  sigData: Record<string, unknown> | null;
  ipAddress: string;
}): string {
  const { companyData, fmcsaData, docsData, wcData, sigData, ipAddress } = data;
  const name = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
  const email = (companyData?.email as string) || "";
  const mc = (companyData?.mc as string) || (fmcsaData?.mc as string) || "—";
  const dot = (companyData?.dot as string) || (fmcsaData?.dot as string) || "—";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const tt = companyData?.trailerTypes as Record<string, boolean> || {};
  const trailers = [tt.reefer && "Reefer", tt.van && "Dry Van", tt.flatbed && "Flatbed"].filter(Boolean).join(", ") || "—";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0;padding:20px}
.wrap{max-width:620px;margin:0 auto;background:white;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a}
.hdr{background:#1a1a1a;padding:24px 28px}
.hdr h1{color:white;margin:0;font-size:20px}
.hdr p{color:#aaa;margin:4px 0 0;font-size:12px}
.body{padding:28px}
.intro{font-size:15px;margin-bottom:24px;color:#333}
.sec{margin-bottom:20px;border:1.5px solid #ddd;border-radius:2px}
.sec-hdr{background:#f5f3ef;padding:8px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#555;border-bottom:1px solid #ddd}
.sec-body{padding:16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}
.f .lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:2px}
.f .val{font-size:14px;color:#222}
.badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:700}
.badge-green{background:#edfaf3;color:#22a355;border:1px solid #22a355}
.badge-gray{background:#f0f0f0;color:#888;border:1px solid #ddd}
.badge-red{background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B}
.pdf-note{background:#f0f6ff;border:1.5px solid #4a90e2;border-radius:2px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#333}
.ftr{background:#f5f3ef;border-top:1px solid #ddd;padding:16px 28px;font-size:11px;color:#888;text-align:center}
</style></head>
<body>
<div class="wrap">
<div class="hdr"><h1>🚛 New Carrier Onboarding: ${name}</h1><p>Simon Express Logistics LLC — ${today}</p></div>
<div class="body">

<div class="pdf-note">📎 <strong>Full onboarding packet attached as PDF</strong> — includes carrier profile, workers comp form, and signed agreement.</div>

<div class="sec">
<div class="sec-hdr">Company Information</div>
<div class="sec-body">
<div class="grid">
<div class="f"><div class="lbl">Legal Name</div><div class="val">${name}</div></div>
<div class="f"><div class="lbl">DBA</div><div class="val">${(companyData?.dba as string) || "—"}</div></div>
<div class="f"><div class="lbl">MC Number</div><div class="val">${mc}</div></div>
<div class="f"><div class="lbl">DOT Number</div><div class="val">${dot}</div></div>
<div class="f"><div class="lbl">EIN / Tax ID</div><div class="val">${(companyData?.ein as string) || "—"}</div></div>
<div class="f"><div class="lbl">Trucks / Trailers</div><div class="val">${(companyData?.truckCount as string) || "—"} / ${(companyData?.trailerCount as string) || "—"}</div></div>
<div class="f"><div class="lbl">Trailer Types</div><div class="val">${trailers}</div></div>
<div class="f"><div class="lbl">Address</div><div class="val">${(companyData?.address as string) || ""}, ${(companyData?.city as string) || ""}, ${(companyData?.state as string) || ""} ${(companyData?.zip as string) || ""}</div></div>
<div class="f"><div class="lbl">Phone</div><div class="val">${(companyData?.phone as string) || "—"}</div></div>
<div class="f"><div class="lbl">Email</div><div class="val">${email || "—"}</div></div>
<div class="f"><div class="lbl">Primary Contact</div><div class="val">${(companyData?.contactName as string) || "—"}</div></div>
<div class="f"><div class="lbl">Quick Pay</div><div class="val">${companyData?.wantsQuickPay ? '<span class="badge badge-green">✓ Opted In</span>' : '<span class="badge badge-gray">No</span>'}</div></div>
<div class="f"><div class="lbl">Factoring</div><div class="val">${companyData?.usesFactoring ? `<span class="badge badge-red">Yes — ${(companyData?.factoringName as string) || ""}</span>` : '<span class="badge badge-gray">No</span>'}</div></div>
</div></div></div>

<div class="sec">
<div class="sec-hdr">Documents</div>
<div class="sec-body"><div class="grid">
<div class="f"><div class="lbl">W-9</div><div class="val">${(docsData as Record<string, unknown>)?.w9Mode === "fill" ? "Filled online" : ((docsData as Record<string, unknown>)?.uploads as Record<string, unknown>)?.w9 ? "✓ Uploaded" : "—"}</div></div>
<div class="f"><div class="lbl">COI</div><div class="val">${((docsData as Record<string, unknown>)?.uploads as Record<string, unknown>)?.ins ? "✓ Uploaded" : (docsData as Record<string, unknown>)?.emailSent ? "Agent notified" : "—"}</div></div>
<div class="f"><div class="lbl">Workers Comp</div><div class="val">${(wcData as Record<string, unknown>)?.hasWC ? "✓ Insurance on file" : "Exemption signed"}</div></div>
</div></div></div>

<div class="sec">
<div class="sec-hdr">Agreement & Signature</div>
<div class="sec-body"><div class="grid">
<div class="f"><div class="lbl">Signed By</div><div class="val">${(sigData as Record<string, unknown>)?.signerName || "—"}</div></div>
<div class="f"><div class="lbl">Title</div><div class="val">${(sigData as Record<string, unknown>)?.signerTitle || "—"}</div></div>
<div class="f"><div class="lbl">Date</div><div class="val">${today}</div></div>
<div class="f"><div class="lbl">IP Address</div><div class="val">${ipAddress || "—"}</div></div>
<div class="f"><div class="lbl">Status</div><div class="val"><span class="badge badge-green">✓ Agreed</span></div></div>
</div></div></div>

</div>
<div class="ftr">Simon Express Logistics LLC · PO Box 1582, Riverton, UT 84065 · MC# 1003278</div>
</div></body></html>`;
}

// Carrier confirmation email (simpler)
function buildCarrierEmail(companyName: string, today: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0;padding:20px}
.wrap{max-width:600px;margin:0 auto;background:white;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a}
.hdr{background:#1a1a1a;padding:24px 28px}.hdr h1{color:white;margin:0;font-size:20px}
.hdr p{color:#aaa;margin:4px 0 0;font-size:12px}
.body{padding:28px;font-size:15px;color:#333;line-height:1.7}
.steps{background:#f5f3ef;border:1.5px solid #ddd;padding:16px 20px;margin:20px 0;border-radius:2px}
.step{display:flex;gap:12px;margin-bottom:12px}
.ftr{background:#f5f3ef;border-top:1px solid #ddd;padding:16px 28px;font-size:11px;color:#888;text-align:center}
</style></head>
<body><div class="wrap">
<div class="hdr"><h1>✓ Application Received</h1><p>Simon Express Logistics LLC — ${today}</p></div>
<div class="body">
<p>Thank you, <strong>${companyName}</strong>!</p>
<p>We've received your carrier onboarding application and our team will review your documents shortly.</p>
<div class="steps">
<div class="step"><span>📋</span><div><strong>Application Review</strong><br>Our team will review your documents and be in touch.</div></div>
<div class="step"><span>📞</span><div><strong>Questions?</strong><br>Call us at <strong>801-260-7010</strong> or email <a href="mailto:dispatch@simonexpress.com">dispatch@simonexpress.com</a></div></div>
</div>
<p style="font-size:13px;color:#888">Simon Express Logistics LLC · PO Box 1582, Riverton, UT 84065 · MC# 1003278</p>
</div>
<div class="ftr">This email was sent because you completed a carrier onboarding application at setup.simonexpress.com</div>
</div></body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ success: false, error: "Email not configured" }, { status: 500 });

    const resend = new Resend(resendKey);
    const body = await req.json();
    const { fmcsaData, companyData, docsData, wcData, sigData } = body;

    // Capture IP address
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "Unknown";

    const carrierEmail = (companyData?.email as string) || "";
    const companyName = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const FROM = process.env.FROM_EMAIL || "onboarding@simonexpress.com";
    const safeName = companyName.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 40);

    // Generate PDF
    console.log("[submit] generating PDF for:", companyName);
    const pdfBytes = await generateOnboardingPDF({
      companyData,
      fmcsaData,
      docsData,
      wcData,
      sigData,
      ipAddress,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    console.log("[submit] PDF generated, size:", pdfBytes.length, "bytes");

    const htmlBody = buildEmailHtml({ companyData, fmcsaData, docsData, wcData, sigData, ipAddress });

    // Send to dispatch with PDF attached
    await resend.emails.send({
      from: FROM,
      to: ["dispatch@simonexpress.com"],
      subject: `🚛 New Carrier Onboarding: ${companyName} (${(companyData?.mc as string) || (fmcsaData?.mc as string) || ""})`,
      html: htmlBody,
      attachments: [
        {
          filename: `Simon_Express_Carrier_Onboarding_${safeName}_${today.replace(/,?\s+/g, "_")}.pdf`,
          content: pdfBase64,
        },
      ],
    });
    console.log("[submit] dispatch email sent");

    // Send confirmation to carrier (no PDF attachment)
    if (carrierEmail) {
      await resend.emails.send({
        from: FROM,
        to: [carrierEmail],
        subject: `✓ Your Simon Express Carrier Application — ${companyName}`,
        html: buildCarrierEmail(companyName, today),
      });
      console.log("[submit] carrier confirmation sent to:", carrierEmail);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[submit] error:", String(err));
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
