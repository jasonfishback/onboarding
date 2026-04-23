import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { generateOnboardingPDF } from "@/lib/generatePdf";
import { generateW9PDF } from "@/lib/generateW9Pdf";
import { buildAttachmentsPdf } from "@/lib/processDocuments";
import { getSessionFiles } from "@/app/api/upload/route";

export const runtime = "nodejs";

// Classify a US phone number into Mobile / Landline / VoIP / Toll-free.
// Strategy: Try Numverify first (real telecom carrier data, 100 free/month),
// fall back to libphonenumber-js (offline, 100% free, less accurate for US).
async function detectPhoneType(phoneStr: string): Promise<{ type: string; color: string; badge: string; carrier?: string; source: string } | null> {
  if (!phoneStr) return null;
  const digits = phoneStr.replace(/[^0-9]/g, "");
  if (digits.length < 10) return null;

  // ── Primary: Numverify (accurate real-time carrier lookup) ──
  const numverifyKey = process.env.NUMVERIFY_API_KE;
  if (numverifyKey) {
    try {
      const numverifyUrl = `http://apilayer.net/api/validate?access_key=${numverifyKey}&number=${digits}&country_code=US&format=1`;
      const res = await fetch(numverifyUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json() as {
          valid?: boolean;
          line_type?: string;
          carrier?: string;
          error?: { code: number; info: string };
        };
        // If Numverify returned a line_type, use it
        if (data.valid === false) {
          return { type: "Invalid", color: "#CC1B1B", badge: "⚠ INVALID", carrier: data.carrier, source: "numverify" };
        }
        if (data.line_type) {
          const lt = data.line_type.toLowerCase();
          const carrier = data.carrier || undefined;
          // Numverify line_type values: mobile, landline, special_services, toll_free, premium_rate, satellite, paging, pager, voip
          if (lt === "mobile") return { type: "Mobile", color: "#22a355", badge: "📱 MOBILE", carrier, source: "numverify" };
          if (lt === "landline") return { type: "Landline", color: "#0066cc", badge: "☎ LANDLINE", carrier, source: "numverify" };
          if (lt === "toll_free") return { type: "Toll-Free", color: "#8a2be2", badge: "📞 TOLL-FREE", carrier, source: "numverify" };
          if (lt === "voip") return { type: "VoIP", color: "#e07000", badge: "🌐 VoIP", carrier, source: "numverify" };
          if (lt === "premium_rate") return { type: "Premium Rate", color: "#CC1B1B", badge: "⚠ PREMIUM RATE", carrier, source: "numverify" };
          if (lt === "satellite") return { type: "Satellite", color: "#666", badge: "🛰 SATELLITE", carrier, source: "numverify" };
        }
        // If Numverify didn't recognize it OR we're out of quota (error returned), fall through to libphonenumber
      }
    } catch {
      // Timeout or network error — fall through to libphonenumber
    }
  }

  // ── Fallback: libphonenumber-js (offline, no API key) ──
  try {
    const parsed = parsePhoneNumberFromString(digits.length === 10 ? `+1${digits}` : `+${digits}`);
    if (!parsed || !parsed.isValid()) {
      return { type: "Invalid", color: "#CC1B1B", badge: "⚠ INVALID", source: "libphonenumber" };
    }
    const type = parsed.getType();
    switch (type) {
      case "MOBILE":
        return { type: "Mobile", color: "#22a355", badge: "📱 MOBILE", source: "libphonenumber" };
      case "FIXED_LINE":
        return { type: "Landline", color: "#0066cc", badge: "☎ LANDLINE", source: "libphonenumber" };
      case "FIXED_LINE_OR_MOBILE":
        return { type: "Mobile/Landline", color: "#666", badge: "📞 MOBILE/LANDLINE", source: "libphonenumber" };
      case "TOLL_FREE":
        return { type: "Toll-Free", color: "#8a2be2", badge: "📞 TOLL-FREE", source: "libphonenumber" };
      case "VOIP":
        return { type: "VoIP", color: "#e07000", badge: "🌐 VoIP", source: "libphonenumber" };
      case "PREMIUM_RATE":
        return { type: "Premium Rate", color: "#CC1B1B", badge: "⚠ PREMIUM RATE", source: "libphonenumber" };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ─── Email HTML builders ───────────────────────────────────────────────────
async function buildDispatchEmail(data: {
  companyData: Record<string, unknown>;
  fmcsaData: Record<string, unknown> | null;
  docsData: Record<string, unknown> | null;
  wcData: Record<string, unknown> | null;
  sigData: Record<string, unknown> | null;
  ipAddress: string;
  geoInfo: Record<string, string>;
}): Promise<string> {
  const { companyData, fmcsaData, docsData, wcData, sigData, ipAddress, geoInfo } = data;
  const name = (companyData?.legalName as string) || (fmcsaData?.name as string) || "Carrier";
  const mc = (companyData?.mc as string) || (fmcsaData?.mc as string) || "—";
  const dot = (companyData?.dot as string) || (fmcsaData?.dot as string) || "—";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver" });
  const tt = (companyData?.trailerTypes as Record<string, boolean>) || {};
  const trailers = [tt.reefer && "Reefer", tt.van && "Dry Van", tt.flatbed && "Flatbed"].filter(Boolean).join(", ") || "—";

  // Pre-compute phone type info (async — Numverify + libphonenumber fallback)
  // If dispatch phone is same as primary, only one validation call is made (saves quota)
  const dispatch = (companyData?.dispatch as Record<string, string>) || {};
  const primaryPhone = (companyData?.phone as string) || "";
  const dispatchPhone = dispatch.phone || "";
  const primaryDigits = primaryPhone.replace(/[^0-9]/g, "");
  const dispatchDigits = dispatchPhone.replace(/[^0-9]/g, "");
  const sameAsPrimary = primaryDigits && primaryDigits === dispatchDigits;
  const phoneTypeInfo = await detectPhoneType(primaryPhone);
  const dispatchPhoneTypeInfo = sameAsPrimary ? phoneTypeInfo : (dispatchPhone ? await detectPhoneType(dispatchPhone) : null);

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
  <p style="color:#ff4444;margin:10px 0 0;font-size:14px;font-weight:900;letter-spacing:.05em;text-transform:uppercase">⚠ Check All Alerts ⚠</p>
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
<div class="f"><div class="lbl">EIN / Tax ID</div><div class="val">${(() => {
  const userEin = ((companyData?.ein as string) || "").replace(/[^0-9]/g, "");
  const fmcsaEin = ((fmcsaData?.fmcsaEin as string) || "").replace(/[^0-9]/g, "");
  const display = (companyData?.ein as string) || "—";
  if (!userEin) return display;
  if (!fmcsaEin) {
    return `${display} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#f5f5f5;color:#888;border:1px solid #ddd">FMCSA: NOT ON FILE</span>`;
  }
  if (userEin === fmcsaEin) {
    return `${display} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ MATCHES FMCSA</span>`;
  }
  return `${display} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ MISMATCH (FMCSA: ${fmcsaEin.slice(0,2)}-${fmcsaEin.slice(2)})</span>`;
})()}</div></div>
<div class="f"><div class="lbl">Trucks / Trailers</div><div class="val">${(companyData?.truckCount as string) || "—"} / ${(companyData?.trailerCount as string) || "—"}</div></div>
<div class="f"><div class="lbl">Trailer Types</div><div class="val">${trailers}</div></div>
<div class="f"><div class="lbl">Primary Phone</div><div class="val">${(() => {
  const userPhone = ((companyData?.phone as string) || "").replace(/[^0-9]/g, "");
  const fmcsaPhone = ((fmcsaData?.phone as string) || "").replace(/[^0-9]/g, "");
  const display = (companyData?.phone as string) || "—";
  if (!userPhone) return display;
  // Phone type badge (Mobile/Landline/VoIP/Toll-Free) — via Numverify → libphonenumber fallback
  const typeBadge = phoneTypeInfo
    ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff;color:${phoneTypeInfo.color};border:1px solid ${phoneTypeInfo.color}">${phoneTypeInfo.badge}${phoneTypeInfo.carrier ? ` · ${phoneTypeInfo.carrier}` : ""}</span>`
    : "";
  // Match/mismatch badge
  if (fmcsaPhone && userPhone === fmcsaPhone) {
    const matchBadge = ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ MATCHES FMCSA</span>`;
    return `${display}${typeBadge}${matchBadge}`;
  }
  if (fmcsaPhone && userPhone !== fmcsaPhone) {
    const fmtFmcsa = fmcsaPhone.length === 10 ? `${fmcsaPhone.slice(0,3)}-${fmcsaPhone.slice(3,6)}-${fmcsaPhone.slice(6)}` : fmcsaPhone;
    const matchBadge = ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ CHANGED — FMCSA: ${fmtFmcsa}</span>`;
    return `<span style="color:#CC1B1B;font-weight:700">${display}</span>${typeBadge}${matchBadge}`;
  }
  return `${display}${typeBadge}`;
})()}</div></div>
${(() => {
  // Dispatch Phone row — only show if provided AND different from primary
  if (!dispatchDigits) return "";
  if (sameAsPrimary) {
    return `<div class="f"><div class="lbl">Dispatch Phone</div><div class="val"><span style="color:#888">${dispatchPhone}</span> <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#f0f0f0;color:#888;border:1px solid #ddd">= PRIMARY</span></div></div>`;
  }
  const typeBadge = dispatchPhoneTypeInfo
    ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff;color:${dispatchPhoneTypeInfo.color};border:1px solid ${dispatchPhoneTypeInfo.color}">${dispatchPhoneTypeInfo.badge}${dispatchPhoneTypeInfo.carrier ? ` · ${dispatchPhoneTypeInfo.carrier}` : ""}</span>`
    : "";
  return `<div class="f"><div class="lbl">Dispatch Phone</div><div class="val">${dispatchPhone}${typeBadge}</div></div>`;
})()}
<div class="f"><div class="lbl">Email</div><div class="val">${(() => {
  const userEmail = ((companyData?.email as string) || "").trim().toLowerCase();
  const fmcsaEmail = ((fmcsaData?.email as string) || "").trim().toLowerCase();
  const display = (companyData?.email as string) || "—";
  if (!userEmail) return display;
  if (!fmcsaEmail) return display;
  if (userEmail === fmcsaEmail) {
    return `${display} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ MATCHES FMCSA</span>`;
  }
  return `<span style="color:#CC1B1B;font-weight:700">${display}</span> <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ CHANGED — FMCSA: ${fmcsaEmail}</span>`;
})()}</div></div>
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

<!-- ── INSURANCE FILINGS (FMCSA) ── -->
${(() => {
  const f = (fmcsaData || {}) as Record<string, string>;
  const hasAny = f.bipdInsuranceOnFile || f.cargoInsuranceOnFile || f.bondInsuranceOnFile ||
    f.bipdInsuranceRequired || f.cargoInsuranceRequired || f.bondInsuranceRequired;
  if (!hasAny) return "";
  // Badge helper: green if on-file meets/exceeds required; red if required but not on file
  const fmt = (v: string) => {
    const n = parseInt(String(v || "").replace(/[^0-9]/g, ""), 10);
    if (!n) return "";
    return n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
  };
  const rowBadge = (onFile: string, required: string, label: string) => {
    if (!onFile && !required) return "";
    const onFileFmt = fmt(onFile);
    const requiredFmt = fmt(required);
    const onFileN = parseInt(String(onFile || "").replace(/[^0-9]/g, ""), 10) || 0;
    const requiredN = parseInt(String(required || "").replace(/[^0-9]/g, ""), 10) || 0;
    let status = "";
    if (requiredN > 0 && onFileN >= requiredN) {
      status = `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ FILED</span>`;
    } else if (requiredN > 0 && onFileN === 0) {
      status = `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ NOT ON FILE</span>`;
    } else if (requiredN > 0 && onFileN > 0 && onFileN < requiredN) {
      status = `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff8ed;color:#e07000;border:1px solid #e07000">⚠ UNDERINSURED</span>`;
    }
    const valText = [
      onFileFmt ? `On file: <strong>${onFileFmt}</strong>` : "",
      requiredFmt ? `Required: ${requiredFmt}` : "",
    ].filter(Boolean).join(" &nbsp;·&nbsp; ") || "—";
    return `<div class="f"><div class="lbl">${label}</div><div class="val">${valText}${status}</div></div>`;
  };
  return `<div class="sec"><div class="sec-hdr">Insurance Filings (FMCSA)</div><div class="sec-body"><div class="grid">
${rowBadge(f.bipdInsuranceOnFile, f.bipdInsuranceRequired || f.bipdRequiredAmount, "Liability (BIPD)")}
${rowBadge(f.cargoInsuranceOnFile, f.cargoInsuranceRequired, "Cargo Insurance")}
${rowBadge(f.bondInsuranceOnFile, f.bondInsuranceRequired, "Broker Bond")}
</div></div></div>`;
})()}

<!-- ── CARRIER ADDRESS LOOKUP (Google Maps) ── -->
${(() => {
  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!gKey) {
    console.warn("[submit] GOOGLE_MAPS_API_KEY not set — skipping Street View section");
    return "";
  }
  const addr = [companyData?.address, companyData?.city, companyData?.state, companyData?.zip].filter(Boolean).join(", ");
  if (!addr) return "";
  const encoded = encodeURIComponent(addr);
  // Street View image — static API
  const streetImgUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encoded}&fov=90&key=${gKey}`;
  // Satellite / map view — static API
  const mapImgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=18&size=600x300&maptype=satellite&markers=color:red%7C${encoded}&key=${gKey}`;
  // Clickable links — Street View deep-link uses the panorama viewer; satellite opens in satellite layer
  const streetViewLink = `https://www.google.com/maps/search/?api=1&query=${encoded}&layer=c`;
  const satelliteLink = `https://www.google.com/maps/@?api=1&map_action=map&basemap=satellite&center=${encoded}&zoom=18`;
  const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  return `<div class="sec"><div class="sec-hdr">Carrier Address — Location Verification</div><div class="sec-body">
  <div style="text-align:center;margin-bottom:10px;color:#555;font-size:12px"><strong>${addr}</strong> &nbsp;·&nbsp; <a href="${googleMapsLink}" style="color:#CC1B1B;text-decoration:none;font-weight:700">Open in Google Maps →</a></div>
  <div style="text-align:center;margin-bottom:10px;color:#888;font-size:11px;font-style:italic">Click either image to open the interactive view in Google Maps. If images don't display, click "Display images" in your email client.</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="50%" style="padding:4px;text-align:center;vertical-align:top">
      <div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🛣 Street View</div>
      <a href="${streetViewLink}" target="_blank" rel="noopener">
        <img src="${streetImgUrl}" alt="Street View — click to open" style="width:100%;max-width:300px;border:1px solid #ddd;border-radius:4px;display:block;margin:0 auto" />
      </a>
      <div style="font-size:10px;color:#888;margin-top:4px"><a href="${streetViewLink}" target="_blank" rel="noopener" style="color:#0066cc;text-decoration:none">Open Street View →</a></div>
    </td>
    <td width="50%" style="padding:4px;text-align:center;vertical-align:top">
      <div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🛰 Satellite / Aerial View</div>
      <a href="${satelliteLink}" target="_blank" rel="noopener">
        <img src="${mapImgUrl}" alt="Satellite View — click to open" style="width:100%;max-width:300px;border:1px solid #ddd;border-radius:4px;display:block;margin:0 auto" />
      </a>
      <div style="font-size:10px;color:#888;margin-top:4px"><a href="${satelliteLink}" target="_blank" rel="noopener" style="color:#0066cc;text-decoration:none">Open Aerial View →</a></div>
    </td>
  </tr></table>
</div></div>`;
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
    const htmlBody = await buildDispatchEmail({ companyData, fmcsaData, docsData, wcData, sigData, ipAddress, geoInfo });
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
