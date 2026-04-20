import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ success: false, error: "Email not configured" }, { status: 500 });

    const resend = new Resend(resendKey);
    const { agentEmail, companyName } = await req.json();

    if (!agentEmail) return NextResponse.json({ error: "No agent email" }, { status: 400 });

    const FROM = process.env.FROM_EMAIL || "onboarding@simonexpress.com";

    await resend.emails.send({
      from: FROM,
      to: [agentEmail],
      cc: ["dispatch@simonexpress.com"],
      subject: `${companyName || "Carrier"} — Insurance Certificate Request`,
      html: `
<body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#333">
  <div style="background:#1a1a1a;padding:20px 28px;margin-bottom:24px">
    <h2 style="color:white;margin:0">Simon Express Logistics LLC</h2>
    <p style="color:#aaa;margin:4px 0 0;font-size:13px">Insurance Certificate Request</p>
  </div>
  <p>Dear Insurance Agent,</p>
  <p>We are requesting a Certificate of Insurance (COI) for your client, <strong>${companyName || "the above insured"}</strong>, who is completing carrier onboarding with us.</p>
  <p>Please issue a certificate with the following as certificate holder:</p>
  <div style="background:#f5f3ef;border:2px solid #1a1a1a;padding:16px 20px;margin:20px 0;font-weight:bold">
    Simon Express Logistics LLC<br>PO Box 1582<br>Riverton, UT 84065
  </div>
  <p>Required coverages:</p>
  <ul>
    <li>Automobile Liability — minimum <strong>$1,000,000</strong> per occurrence</li>
    <li>Motor Truck Cargo Legal Liability — minimum <strong>$100,000</strong> per occurrence</li>
    <li>Workers' Compensation as required by applicable state law</li>
  </ul>
  <p>Please email the COI to <a href="mailto:dispatch@simonexpress.com">dispatch@simonexpress.com</a> or fax to <strong>801-663-7537</strong>.</p>
  <p>Questions? Call <strong>801-260-7010</strong>.</p>
  <p>Thank you,<br><strong>Simon Express Logistics LLC</strong><br><a href="mailto:dispatch@simonexpress.com">dispatch@simonexpress.com</a> &nbsp;·&nbsp; 801-260-7010 &nbsp;·&nbsp; Fax: 801-663-7537</p>
</body>`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agent email error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
