import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateOnboardingPDF } from "@/lib/generatePdf";
import { generateW9PDF } from "@/lib/generateW9Pdf";
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
  geoInfo: Record<string, string>;
}): string {
  const { companyData, fmcsaData, docsData, wcData, sigData, ipAddress, geoInfo } = data;
  const name = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
  const mc = (companyData?.mc as string) || (fmcsaData?.mc as string) || "—";
  const dot = (companyData?.dot as string) || (fmcsaData?.dot as string) || "—";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver" });
  const tt = (companyData?.trailerTypes as Record<string, boolean>) || {};
  const trailers = [tt.reefer && "Reefer", tt.van && "Dry Van", tt.flatbed && "Flatbed"].filter(Boolean).join(", ") || "—";

  // ── Document status logic ──
  const docs = (docsData || {}) as Record<string, unknown>;
  const uploads = (docs.uploads || {}) as Record<string, string>;
  const wc = (wcData || {}) as Record<string, unknown>;
  const sig = (sigData || {}) as Record<string, unknown>;

  const agreementSigned = !!sig.signerName && !!sig.agreed;
  const wcHasInsurance = !!wc.hasWC && !!wc.wcUpload;
  const wcExemptSigned = !wc.hasWC && !!wc.exemptSigned && !!wc.signerName;
  const wcOk = wcHasInsurance || wcExemptSigned;
  const wcLabel = wcHasInsurance ? "Workers Comp — Insurance Certificate Uploaded" : wcExemptSigned ? "Workers Comp — Exemption Form Signed" : "Workers Comp";
  const w9Ok = docs.w9Mode === "fill" ? !!(docs.w9Form as Record<string, string>)?.name : !!uploads.w9;
  const w9Label = docs.w9Mode === "fill" ? "W-9 — Filled Out Online" : uploads.w9 ? `W-9 — Uploaded (${uploads.w9})` : "W-9";
  const coiUploaded = !!uploads.ins;
  const coiAgentNotified = !!docs.emailSent && !!docs.agentEmail;
  const coiOk = coiUploaded; // only green if actually uploaded
  const coiLabel = coiUploaded
    ? `Insurance Certificate — Uploaded (${uploads.ins})`
    : coiAgentNotified
      ? `Insurance Certificate — Not Uploaded`
      : "Insurance Certificate";
  const coiDetail = coiAgentNotified && !coiUploaded
    ? `Request sent to agent: ${docs.agentEmail} — certificate not yet uploaded`
    : undefined;

  // Helper: render a checklist row (ok=green, warn=orange, false=gray)
  const checkRow = (ok: boolean | "warn", label: string, detail?: string) => {
    const bg = ok === true ? "#22a355" : ok === "warn" ? "#e07000" : "#CC1B1B";
    const icon = ok === true ? "✓" : ok === "warn" ? "!" : "✗";
    const badgeBg = ok === true ? "#edfaf3" : ok === "warn" ? "#fff8ed" : "#fff5f5";
    const badgeColor = ok === true ? "#22a355" : ok === "warn" ? "#e07000" : "#CC1B1B";
    const badgeBorder = ok === true ? "#22a355" : ok === "warn" ? "#e07000" : "#CC1B1B";
    const badgeText = ok === true ? "RECEIVED" : ok === "warn" ? "PENDING" : "MISSING";
    return `
  <tr>
    <td style="padding:10px 14px;vertical-align:top;width:48px">
      <div style="width:32px;height:32px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:white;text-align:center;line-height:32px">
        ${icon}
      </div>
    </td>
    <td style="padding:10px 0;vertical-align:middle">
      <div style="font-size:15px;font-weight:700;color:#1a1a1a">${label}</div>
      ${detail ? `<div style="font-size:12px;color:#888;margin-top:2px">${detail}</div>` : ""}
    </td>
    <td style="padding:10px 14px;vertical-align:middle;text-align:right;white-space:nowrap">
      <span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:12px;font-weight:700;background:${badgeBg};color:${badgeColor};border:1px solid ${badgeBorder}">
        ${badgeText}
      </span>
    </td>
  </tr>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0;padding:20px}
.wrap{max-width:640px;margin:0 auto;background:white;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a}
.hdr{background:#1a1a1a;padding:24px 28px}
.hdr h1{color:white;margin:0;font-size:22px;letter-spacing:-.3px}
.hdr p{color:#aaa;margin:6px 0 0;font-size:13px}
.body{padding:28px}
.checklist-wrap{border:2px solid #1a1a1a;border-radius:3px;overflow:hidden;margin-bottom:24px;box-shadow:3px 3px 0 #1a1a1a}
.checklist-hdr{background:#1a1a1a;padding:12px 18px;display:flex;align-items:center;gap:10px}
.checklist-hdr span{color:white;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.checklist-table{width:100%;border-collapse:collapse}
.checklist-table tr{border-bottom:1px solid #f0f0f0}
.checklist-table tr:last-child{border-bottom:none}
.checklist-table tr:nth-child(even){background:#fafafa}
.pdf-note{background:#f0f6ff;border:1.5px solid #4a90e2;border-radius:2px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#333}
.sec{margin-bottom:20px;border:1.5px solid #ddd;border-radius:2px}
.sec-hdr{background:#f5f3ef;padding:8px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#555;border-bottom:1px solid #ddd}
.sec-body{padding:16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}
.f .lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:2px}
.f .val{font-size:14px;color:#222}
.badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:700}
.bg{background:#edfaf3;color:#22a355;border:1px solid #22a355}
.br{background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B}
.bn{background:#f0f0f0;color:#888;border:1px solid #ddd}
.ftr{background:#f5f3ef;border-top:1px solid #ddd;padding:16px 28px;font-size:11px;color:#888;text-align:center}
</style></head><body>
<div class="wrap">

<div class="hdr">
  <h1>🚛 New Carrier Onboarding</h1>
  <p>${name} &nbsp;·&nbsp; MC# ${mc} &nbsp;·&nbsp; ${today}</p>
  ${(companyData?.city || companyData?.state) ? `<p style="color:#ccc;margin:3px 0 0;font-size:13px">📍 ${[companyData?.city, companyData?.state].filter(Boolean).join(", ")}</p>` : ""}
</div>

${(() => {
  if (!ipAddress) return "";
  const isUSA = !geoInfo.countryCode || geoInfo.countryCode === "US";
  const location = [geoInfo.city, geoInfo.region, geoInfo.country].filter(Boolean).join(", ");
  if (!isUSA) {
    return `<div style="background:#CC1B1B;padding:16px 24px;border-bottom:3px solid #8b0000">
  <div style="font-size:22px;font-weight:900;color:white;letter-spacing:1px;margin-bottom:6px">
    🚩🚩🚩 &nbsp;NOT IN USA!!! &nbsp;🚩🚩🚩
  </div>
  <div style="color:#ffe0e0;font-size:14px;font-weight:700;line-height:1.8">
    IP: <span style="color:white">${ipAddress}</span> &nbsp;·&nbsp;
    Location: <span style="color:white">${location || "Unknown"}</span> &nbsp;·&nbsp;
    ISP: <span style="color:white">${geoInfo.isp || "Unknown"}</span>
  </div>
</div>`;
  }
  return `<div style="background:#1a1a1a;padding:10px 24px;border-bottom:2px solid #333">
  <div style="color:#CC1B1B;font-size:13px;font-weight:700;line-height:1.8">
    🌐 &nbsp;
    <strong style="color:#ff6b6b">IP: ${ipAddress}</strong>
    ${location ? ` &nbsp;·&nbsp; <strong style="color:#ff6b6b">${location}</strong>` : ""}
    ${geoInfo.isp ? ` &nbsp;·&nbsp; <strong style="color:#ff6b6b">ISP: ${geoInfo.isp}</strong>` : ""}
    ${geoInfo.proxy && geoInfo.proxy !== "No" ? ` &nbsp;·&nbsp; <strong style="color:#ffaa00">🚩🚩🚩 PROXY/VPN DETECTED</strong>` : ""}
  </div>
</div>`;
})()}

${(() => {
  const rating = (fmcsaData?.safetyRating as string) || "";
  if (!rating) return "";
  const r = rating.toLowerCase();
  if (r.includes("conditional") || r.includes("unsatisfactory")) {
    const label = r.includes("unsatisfactory") ? "UNSATISFACTORY" : "CONDITIONAL";
    return `<div style="background:#CC1B1B;padding:14px 24px;border-bottom:3px solid #8b0000;text-align:center">
  <div style="font-size:20px;font-weight:900;color:white;letter-spacing:1px">
    ⚠️ &nbsp;WARNING: ${label} SAFETY RATING&nbsp; ⚠️
  </div>
  <div style="color:#ffe0e0;font-size:13px;font-weight:700;margin-top:4px">
    This carrier has a <span style="color:white;text-decoration:underline">${rating.toUpperCase()}</span> FMCSA safety rating — review carefully before approval
  </div>
</div>`;
  }
  return "";
})()}

<div class="body">

<!-- ── DOCUMENT CHECKLIST ── -->
<div class="checklist-wrap">
  <div class="checklist-hdr">
    <span>📋 Document Status</span>
  </div>
  <table class="checklist-table">
    ${checkRow(agreementSigned, "Carrier Agreement Signed", agreementSigned ? `Signed by ${sig.signerName as string}${sig.signerTitle ? `, ${sig.signerTitle as string}` : ""} &nbsp;·&nbsp; IP: ${ipAddress}` : "Not signed")}
    ${checkRow(wcOk, wcLabel, !wcOk ? "Workers comp documentation missing" : undefined)}
    ${checkRow(w9Ok, w9Label, !w9Ok ? "W-9 not provided" : undefined)}
    ${checkRow(coiUploaded ? true : coiAgentNotified ? "warn" : false, coiLabel, coiDetail ?? (!coiUploaded && !coiAgentNotified ? "Certificate of insurance not received" : undefined))}
  </table>
</div>

<div class="pdf-note">📎 <strong>Two PDFs attached:</strong> (1) Onboarding Packet — carrier profile, workers comp form &amp; signed agreement &nbsp;|&nbsp; (2) Supporting Documents — uploaded files, processed &amp; compressed</div>

<!-- ── COMPANY INFO ── -->
<div class="sec"><div class="sec-hdr">Company Information</div><div class="sec-body"><div class="grid">
<div class="f"><div class="lbl">Legal Name</div><div class="val">${name}</div></div>
<div class="f"><div class="lbl">DBA</div><div class="val">${(companyData?.dba as string) || "—"}</div></div>
<div class="f"><div class="lbl">MC #</div><div class="val">${mc}</div></div>
<div class="f"><div class="lbl">DOT #</div><div class="val">${dot}</div></div>
<div class="f"><div class="lbl">EIN / Tax ID</div><div class="val">${(companyData?.ein as string) || "—"}</div></div>
<div class="f"><div class="lbl">Trucks / Trailers</div><div class="val">${(companyData?.truckCount as string) || "—"} / ${(companyData?.trailerCount as string) || "—"}</div></div>
<div class="f"><div class="lbl">Trailer Types</div><div class="val">${trailers}</div></div>
<div class="f"><div class="lbl">Phone</div><div class="val">${(companyData?.phone as string) || "—"}</div></div>
<div class="f"><div class="lbl">Email</div><div class="val">${(companyData?.email as string) || "—"}</div></div>
<div class="f"><div class="lbl">Primary Contact</div><div class="val">${(companyData?.contactName as string) || "—"}</div></div>
<div class="f"><div class="lbl">Quick Pay</div><div class="val">${companyData?.wantsQuickPay ? '<span class="badge bg">✓ Yes (5% fee)</span>' : '<span class="badge bn">No</span>'}</div></div>
<div class="f"><div class="lbl">Factoring</div><div class="val">${companyData?.usesFactoring ? `<span class="badge br">Yes — ${(companyData?.factoringName as string) || ""}</span>` : '<span class="badge bn">No</span>'}</div></div>
</div></div></div>

<!-- ── FMCSA SAFETY SNAPSHOT ── -->
${(() => {
  const f = (fmcsaData || {}) as Record<string, string>;
  if (!f.safetyRating && !f.operationClass && !f.outOfService && !f.truckCount) return "";
  const oos = f.outOfService === "Yes";
  return `<div class="sec"><div class="sec-hdr" style="${oos ? 'background:#ffdddd;color:#CC1B1B;border-color:#CC1B1B' : ''}">FMCSA Safety Snapshot${oos ? " ⚠ OUT OF SERVICE" : ""}</div><div class="sec-body"><div class="grid">
${f.safetyRating ? `<div class="f"><div class="lbl">Safety Rating</div><div class="val">${f.safetyRating}${f.safetyRatingDate ? ` <span style="color:#888">(${f.safetyRatingDate})</span>` : ""}</div></div>` : ""}
${f.operationClass ? `<div class="f"><div class="lbl">Operation Class</div><div class="val">${f.operationClass}</div></div>` : ""}
${f.truckCount ? `<div class="f"><div class="lbl">Power Units (FMCSA)</div><div class="val">${f.truckCount}</div></div>` : ""}
${f.driverCount ? `<div class="f"><div class="lbl">Drivers (FMCSA)</div><div class="val">${f.driverCount}</div></div>` : ""}
${f.hazmatFlag === "Yes" ? `<div class="f"><div class="lbl">Hazmat</div><div class="val"><strong style="color:#CC1B1B">Yes</strong></div></div>` : ""}
${oos ? `<div class="f"><div class="lbl">Status</div><div class="val"><strong style="color:#CC1B1B">⚠ OUT OF SERVICE</strong></div></div>` : ""}
</div></div></div>`;
})()}

<!-- ── SIGNATURE ── -->
<div class="sec"><div class="sec-hdr">Agreement &amp; Signature</div><div class="sec-body"><div class="grid">
<div class="f"><div class="lbl">Signed By</div><div class="val">${sig.signerName as string || "—"}</div></div>
<div class="f"><div class="lbl">Title</div><div class="val">${sig.signerTitle as string || "—"}</div></div>
<div class="f"><div class="lbl">Date Signed</div><div class="val">${today}</div></div>
<div class="f"><div class="lbl">IP Address</div><div class="val" style="font-family:monospace;font-size:12px">${ipAddress}</div></div>
${geoInfo.city || geoInfo.region ? `<div class="f"><div class="lbl">Signed From</div><div class="val"><strong>${[geoInfo.city, geoInfo.region].filter(Boolean).join(", ")}</strong>${geoInfo.country ? ` &nbsp;(${geoInfo.country})` : ""}</div></div>` : ""}
${geoInfo.isp ? `<div class="f"><div class="lbl">Internet Provider</div><div class="val"><strong>${geoInfo.isp}</strong></div></div>` : ""}
${geoInfo.mobile ? `<div class="f"><div class="lbl">Mobile Device</div><div class="val">${geoInfo.mobile}</div></div>` : ""}
${geoInfo.proxy && geoInfo.proxy !== "No" ? `<div class="f" style="grid-column:1/-1"><div class="lbl">⚠ Proxy / VPN</div><div class="val" style="color:#CC1B1B;font-weight:700">${geoInfo.proxy} — Signed via proxy or VPN</div></div>` : ""}
</div></div></div>

</div>
<div class="ftr">
  Simon Express Logistics LLC &nbsp;·&nbsp; PO Box 1582, Riverton, UT 84065 &nbsp;·&nbsp; 801-260-7010
  <br style="margin:3px 0">
  <span style="border-top:1px solid #555;display:block;padding-top:4px;margin-top:4px">
    ${name} &nbsp;·&nbsp; ${mc !== "—" ? `MC# ${mc}` : ""} ${dot !== "—" ? `&nbsp;·&nbsp; DOT# ${dot}` : ""}
  </span>
</div>
</div></body></html>`;
}

function buildCarrierConfirmEmail(companyName: string, today: string, mc?: string, dot?: string): string {
  const carrierLine = [companyName, mc ? `MC# ${mc}` : "", dot ? `DOT# ${dot}` : ""].filter(Boolean).join(" · ");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f5f3ef;margin:0;padding:20px}
.wrap{max-width:600px;margin:0 auto;background:white;border:2px solid #1a1a1a;box-shadow:4px 4px 0 #1a1a1a}
.hdr{background:#1a1a1a;padding:24px 28px}.hdr h1{color:white;margin:0;font-size:20px}
.hdr p{color:#aaa;margin:4px 0 0;font-size:12px}
.body{padding:28px;font-size:15px;color:#333;line-height:1.7}
.box{background:#f5f3ef;border:1.5px solid #ddd;padding:16px 20px;margin:20px 0;border-radius:2px}
.ftr{background:#f5f3ef;border-top:1px solid #ddd;padding:16px 28px;font-size:11px;color:#888;text-align:center}
</style></head><body><div class="wrap">
<div class="hdr"><h1>Application Received</h1><p>Simon Express Logistics LLC — ${today}</p></div>
<div class="body">
<p>Thank you, <strong>${companyName}</strong>!</p>
<p>We've received your carrier onboarding application. Our team will review your documents and be in touch shortly.</p>
<div class="box">
<strong>Questions?</strong><br>
Call us at <strong>801-260-7010</strong><br>
Email: <a href="mailto:dispatch@simonexpress.com">dispatch@simonexpress.com</a><br>
Fax: 801-663-7537
</div>
</div>
<div class="ftr">
  Simon Express Logistics LLC &nbsp;·&nbsp; PO Box 1582, Riverton, UT 84065
  <br><span style="display:block;border-top:1px solid #ccc;margin-top:5px;padding-top:5px">${carrierLine}</span>
</div>
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

    // Geo-lookup the IP (free, no API key needed)
    let geoInfo: Record<string, string> = {};
    if (ipAddress && ipAddress !== "Unknown" && !ipAddress.startsWith("127.") && !ipAddress.startsWith("::1")) {
      try {
        const geoRes = await fetch(
          `http://ip-api.com/json/${ipAddress}?fields=status,city,regionName,country,zip,isp,org,as,mobile,proxy,hosting,query`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo.status === "success") {
            geoInfo = {
              city: geo.city || "",
              region: geo.regionName || "",
              country: geo.country || "",
              zip: geo.zip || "",
              isp: geo.isp || "",
              org: geo.org || "",
              as: geo.as || "",
              mobile: geo.mobile ? "Yes" : "No",
              proxy: geo.proxy ? "⚠ Yes" : "No",
              hosting: geo.hosting ? "Yes (VPN/Hosting)" : "No",
            };
          }
        }
      } catch (err) {
        console.log("[submit] geo lookup failed (non-critical):", String(err));
      }
    }

    const companyName = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
    const carrierEmail = (companyData?.email as string) || "";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver" });
    const FROM = process.env.FROM_EMAIL || "onboarding@simonexpress.com";
    const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 35);

    // ── 1. Generate main onboarding packet PDF ──
    console.log("[submit] generating onboarding packet PDF...");
    console.log("[submit] sigData keys:", Object.keys(sigData || {}));
    console.log("[submit] signatureImage size:", (sigData?.signatureImage as string)?.length || 0);
    let packetBytes: Uint8Array;
    try {
      packetBytes = await generateOnboardingPDF({
        companyData, fmcsaData, docsData, wcData, sigData, ipAddress, geoInfo,
      });
      console.log("[submit] packet PDF:", packetBytes.length, "bytes");
    } catch (pdfErr) {
      console.error("[submit] PDF generation failed:", String(pdfErr));
      throw pdfErr;
    }

    // ── 2. Generate attachments PDF (uploaded docs) ──
    const attachments: Array<{ filename: string; content: string }> = [
      {
        filename: `Simon_Express_Onboarding_Packet_${safeName}.pdf`,
        content: Buffer.from(packetBytes!).toString("base64"),
      },
    ];

    // ── 2b. Generate W-9 PDF if carrier filled it out online ──
    const w9Form = (docsData?.w9Form || {}) as Record<string, string>;
    if (w9Form.name || w9Form.ein) {
      try {
        const w9Bytes = await generateW9PDF(w9Form, companyData as Record<string, unknown>, sigData as Record<string, unknown>);
        attachments.push({
          filename: `W9_${safeName}.pdf`,
          content: Buffer.from(w9Bytes).toString("base64"),
        });
        console.log("[submit] W-9 PDF generated:", w9Bytes.length, "bytes");
      } catch (w9Err) {
        console.error("[submit] W-9 PDF generation failed (non-critical):", String(w9Err));
      }
    }

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
    const htmlBody = buildDispatchEmail({ companyData, fmcsaData, docsData, wcData, sigData, ipAddress, geoInfo });
    await resend.emails.send({
      from: FROM,
      to: ["setup@simonexpress.com"],
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
        html: buildCarrierConfirmEmail(companyName, today, (companyData?.mc as string) || (fmcsaData?.mc as string), (companyData?.dot as string) || (fmcsaData?.dot as string)),
      });
      console.log("[submit] carrier confirmation sent to:", carrierEmail);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    console.error("[submit] FATAL error:", e?.message || String(err));
    console.error("[submit] stack:", e?.stack || "no stack");
    return NextResponse.json({ success: false, error: e?.message || String(err) }, { status: 500 });
  }
}
