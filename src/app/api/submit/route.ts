import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

function buildEmailHtml(data: {
  companyData: Record<string, unknown>;
  fmcsaData: Record<string, unknown> | null;
  docsData: Record<string, unknown> | null;
  wcData: Record<string, unknown> | null;
  sigData: Record<string, unknown> | null;
}): string {
  const { companyData, fmcsaData, docsData, wcData, sigData } = data;
  const name = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
  const email = (companyData?.email as string) || "";
  const mc = (companyData?.mc as string) || (fmcsaData?.mc as string) || "—";
  const dot = (companyData?.dot as string) || (fmcsaData?.dot as string) || "—";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0;padding:20px}
.wrap{max-width:600px;margin:0 auto;background:white;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a}
.hdr{background:#1a1a1a;padding:24px 28px}
.hdr h1{color:white;margin:0;font-size:20px}
.hdr p{color:#aaa;margin:4px 0 0;font-size:12px}
.body{padding:28px}
.sec{margin-bottom:20px;border:1.5px solid #ddd}
.sec-hdr{background:#f5f3ef;padding:8px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#555;border-bottom:1px solid #ddd}
.sec-body{padding:14px}
.row{display:flex;gap:16px;margin-bottom:8px}
.f{flex:1}
.fl{font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:2px}
.fv{font-size:14px;color:#222}
.ftr{background:#f5f3ef;border-top:1px solid #ddd;padding:16px 28px;font-size:11px;color:#888;text-align:center}
</style></head>
<body>
<div class="wrap">
<div class="hdr"><h1>✓ Carrier Onboarding Application</h1><p>Simon Express Logistics LLC — ${today}</p></div>
<div class="body">
<p style="font-size:15px;margin-bottom:20px">Thank you, <strong>${name}</strong>! Your onboarding application has been received. Our team will review your documents and follow up soon.</p>

<div class="sec">
<div class="sec-hdr">Company Information</div>
<div class="sec-body">
<div class="row"><div class="f"><div class="fl">Legal Name</div><div class="fv">${name}</div></div><div class="f"><div class="fl">DBA</div><div class="fv">${(companyData?.dba as string) || "—"}</div></div></div>
<div class="row"><div class="f"><div class="fl">MC Number</div><div class="fv">${mc}</div></div><div class="f"><div class="fl">DOT Number</div><div class="fv">${dot}</div></div></div>
<div class="row"><div class="f"><div class="fl">EIN/Tax ID</div><div class="fv">${(companyData?.ein as string) || "—"}</div></div><div class="f"><div class="fl">Trucks/Trailers</div><div class="fv">${(companyData?.truckCount as string) || "—"} / ${(companyData?.trailerCount as string) || "—"}</div></div></div>
<div class="row"><div class="f"><div class="fl">Address</div><div class="fv">${(companyData?.address as string) || ""}, ${(companyData?.city as string) || ""}, ${(companyData?.state as string) || ""} ${(companyData?.zip as string) || ""}</div></div></div>
<div class="row"><div class="f"><div class="fl">Phone</div><div class="fv">${(companyData?.phone as string) || "—"}</div></div><div class="f"><div class="fl">Email</div><div class="fv">${email || "—"}</div></div></div>
<div class="row"><div class="f"><div class="fl">Primary Contact</div><div class="fv">${(companyData?.contactName as string) || "—"}</div></div><div class="f"><div class="fl">Quick Pay</div><div class="fv">${companyData?.wantsQuickPay ? "✓ Opted In (5% fee)" : "No"}</div></div></div>
</div></div>

<div class="sec">
<div class="sec-hdr">Documents Submitted</div>
<div class="sec-body">
<div class="row"><div class="f"><div class="fl">W-9</div><div class="fv">${(docsData as Record<string, unknown>)?.w9Mode === "fill" ? "Filled online" : ((docsData as Record<string, unknown>)?.uploads as Record<string, unknown>)?.w9 ? "✓ Uploaded" : "—"}</div></div><div class="f"><div class="fl">COI</div><div class="fv">${((docsData as Record<string, unknown>)?.uploads as Record<string, unknown>)?.ins ? "✓ Uploaded" : (docsData as Record<string, unknown>)?.emailSent ? "Agent notified" : "—"}</div></div></div>
<div class="row"><div class="f"><div class="fl">Workers Comp</div><div class="fv">${(wcData as Record<string, unknown>)?.hasWC ? "✓ Insurance provided" : "Exemption signed"}</div></div></div>
</div></div>

<div class="sec">
<div class="sec-hdr">Agreement</div>
<div class="sec-body">
<div class="row"><div class="f"><div class="fl">Signed By</div><div class="fv">${(sigData as Record<string, unknown>)?.signerName || "—"}</div></div><div class="f"><div class="fl">Title</div><div class="fv">${(sigData as Record<string, unknown>)?.signerTitle || "—"}</div></div></div>
<div class="row"><div class="f"><div class="fl">Date</div><div class="fv">${(sigData as Record<string, unknown>)?.sigDate || today}</div></div><div class="f"><div class="fl">Status</div><div class="fv">✓ Agreed</div></div></div>
</div></div>

<p style="font-size:13px;color:#555;margin-top:20px">Questions? Call <a href="tel:8012607010">801-260-7010</a> or email <a href="mailto:dispatch@simonexpress.com">dispatch@simonexpress.com</a></p>
</div>
<div class="ftr">Simon Express Logistics LLC · PO Box 1582, Riverton, UT 84065 · MC# 1003278</div>
</div></body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ success: false, error: "Email not configured" }, { status: 500 });

    const resend = new Resend(resendKey);
    const body = await req.json();
    const { fmcsaData, companyData, docsData, wcData, sigData } = body;

    const carrierEmail = (companyData?.email as string) || "";
    const companyName = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
    const html = buildEmailHtml({ companyData, fmcsaData, docsData, wcData, sigData });
    const FROM = process.env.FROM_EMAIL || "onboarding@simonexpress.com";

    // Notify dispatch
    await resend.emails.send({
      from: FROM,
      to: ["dispatch@simonexpress.com"],
      subject: `🚛 New Carrier Onboarding: ${companyName}`,
      html,
    });

    // Confirm to carrier
    if (carrierEmail) {
      await resend.emails.send({
        from: FROM,
        to: [carrierEmail],
        subject: `✓ Your Simon Express Carrier Application — ${companyName}`,
        html,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
