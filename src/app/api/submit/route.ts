import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { generateOnboardingPDF } from "@/lib/generatePdf";
import { generateW9PDF } from "@/lib/generateW9Pdf";
import { buildAttachmentsPdf } from "@/lib/processDocuments";
import { validateEmail } from "@/lib/validateEmail";
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
export async function buildDispatchEmail(data: {
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
  // Normalize MC# — strip any leading "MC" prefix so we never render "MC MC024308"
  const mcRaw = (companyData?.mc as string) || (fmcsaData?.mc as string) || "";
  const mcDigits = mcRaw.replace(/[^0-9]/g, "");
  const mc = mcDigits || "—";
  const hasMc = !!mcDigits;
  // DOT# similarly
  const dotRaw = (companyData?.dot as string) || (fmcsaData?.dot as string) || "";
  const dotDigits = dotRaw.replace(/[^0-9]/g, "");
  const dot = dotDigits || "—";
  const hasDot = !!dotDigits;
  // Likely intrastate carrier: has DOT# but no MC# authority
  const likelyIntrastate = hasDot && !hasMc;
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

  // Pre-compute email validation for all email fields (primary, dispatch, billing, agent)
  // Dedupe identical emails to a single validation call so we don't waste Abstract's free tier (100/mo)
  const billing = (companyData?.billing as Record<string, string>) || {};
  const primaryEmail = ((companyData?.email as string) || "").trim();
  const dispatchEmail = (dispatch.email || "").trim();
  const billingEmail = (billing.email || "").trim();
  const agentEmail = ((docsData?.agentEmail as string) || "").trim();

  // Collect unique lowercased addresses, validate each once, then map back
  const uniqueEmails = Array.from(new Set(
    [primaryEmail, dispatchEmail, billingEmail, agentEmail]
      .filter(Boolean)
      .map(e => e.toLowerCase())
  ));
  const validationResults = await Promise.all(uniqueEmails.map(e => validateEmail(e)));
  const validationByEmail = new Map<string, Awaited<ReturnType<typeof validateEmail>>>();
  uniqueEmails.forEach((e, i) => validationByEmail.set(e, validationResults[i]));
  const getValidation = (e: string) => e ? validationByEmail.get(e.toLowerCase()) ?? null : null;
  const primaryEmailValidation = getValidation(primaryEmail);
  const dispatchEmailValidation = getValidation(dispatchEmail);
  const billingEmailValidation = getValidation(billingEmail);
  const agentEmailValidation = getValidation(agentEmail);
  const sameEmail = primaryEmail && primaryEmail.toLowerCase() === dispatchEmail.toLowerCase();
  const billingSameAsPrimary = primaryEmail && primaryEmail.toLowerCase() === billingEmail.toLowerCase();
  const billingSameAsDispatch = dispatchEmail && dispatchEmail.toLowerCase() === billingEmail.toLowerCase();

  // Helper: build a compact validation badge HTML for an email.
  // Only renders a badge when something is WRONG. A passing email shows no badge
  // (a green check doesn't guarantee actual deliverability, so we don't imply that).
  const emailBadgeHtml = (v: Awaited<ReturnType<typeof validateEmail>> | null): string => {
    if (!v) return "";
    const base = "display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700";
    if (v.disposable) {
      return ` <span style="${base};background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ DISPOSABLE</span>`;
    }
    if (!v.format) {
      return ` <span style="${base};background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ INVALID FORMAT</span>`;
    }
    if (!v.hasMx) {
      return ` <span style="${base};background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ NO MAIL SERVER</span>`;
    }
    if (v.deliverability === "UNDELIVERABLE") {
      return ` <span style="${base};background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ UNDELIVERABLE</span>`;
    }
    if (v.deliverability === "RISKY") {
      return ` <span style="${base};background:#fff8ed;color:#e07000;border:1px solid #e07000">⚠ RISKY</span>`;
    }
    // Passing — no badge shown
    return "";
  };

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
    <td style="padding:12px 14px;vertical-align:top;width:48px">
      <div style="width:32px;height:32px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:white;text-align:center;line-height:32px">
        ${icon}
      </div>
    </td>
    <td style="padding:12px 0;vertical-align:middle">
      <div style="font-size:15px;font-weight:700;color:#1a1a1a">${label}</div>
      ${detail ? `<div style="font-size:12px;color:#888;margin-top:2px">${detail}</div>` : ""}
    </td>
    <td style="padding:12px 14px;vertical-align:middle;text-align:right;white-space:nowrap">
      <span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:700;background:${badgeBg};color:${badgeColor};border:1px solid ${badgeBorder};letter-spacing:.04em">
        ${badgeText}
      </span>
    </td>
  </tr>`;
  };

  // ── ALERT TALLIES (for summary card at top of email) ──
  // Count issues across all categories so the reviewer can see at a glance if everything's OK or needs attention.
  const alerts: { level: "ok" | "warn" | "fail"; label: string }[] = [];
  // Documents
  // Documents (Carrier Agreement, Workers Comp, W-9, COI) are covered in the Document Status section below — no duplication in Alerts
  // Intrastate warning — DOT# present but no MC# authority on file
  if (likelyIntrastate) {
    alerts.push({ level: "warn", label: "Possible intrastate-only carrier — please verify" });
  }
  // Refrigerated Food cargo check — Simon Express does mostly reefer freight, so we want to
  // flag carriers who haven't declared Refrigerated Food as a cargo type on their FMCSA record.
  const cargoArr = (fmcsaData?.cargoCarried as string[]) || [];
  const hasRefrigeratedFood = cargoArr.some(c =>
    /refrigerated\s*food/i.test(c)
  );
  if (cargoArr.length === 0) {
    alerts.push({ level: "warn", label: "No cargo types declared with FMCSA — please verify" });
  } else if (!hasRefrigeratedFood) {
    alerts.push({ level: "warn", label: "Refrigerated Food not listed in FMCSA cargo types — please verify" });
  }
  // COI (Certificate of Insurance) status is covered in the Document Status section below — no duplication in Alerts
  // EIN match
  const userEinDigits = ((companyData?.ein as string) || "").replace(/[^0-9]/g, "");
  const fmcsaEinDigits = ((fmcsaData?.fmcsaEin as string) || "").replace(/[^0-9]/g, "");
  if (userEinDigits && fmcsaEinDigits) {
    alerts.push({
      level: userEinDigits === fmcsaEinDigits ? "ok" : "fail",
      label: userEinDigits === fmcsaEinDigits ? "EIN matches FMCSA" : "EIN does NOT match FMCSA",
    });
  }
  // Phone match
  if (primaryDigits && fmcsaData?.phone) {
    const fmcsaPhoneDigits = String(fmcsaData.phone).replace(/[^0-9]/g, "");
    if (fmcsaPhoneDigits) {
      alerts.push({
        level: primaryDigits === fmcsaPhoneDigits ? "ok" : "warn",
        label: primaryDigits === fmcsaPhoneDigits ? "Phone matches FMCSA" : "Phone differs from FMCSA",
      });
    }
  }
  // Phone type risk — VoIP or Premium Rate is a soft warning
  if (phoneTypeInfo) {
    if (phoneTypeInfo.type === "VoIP") alerts.push({ level: "warn", label: "Primary phone is VoIP" });
    if (phoneTypeInfo.type === "Premium Rate") alerts.push({ level: "fail", label: "Primary phone is premium rate" });
    if (phoneTypeInfo.type === "Invalid") alerts.push({ level: "fail", label: "Primary phone invalid" });
  }
  // Email validation — only surface PROBLEMS in the summary (a pass doesn't guarantee deliverability)
  if (primaryEmailValidation) {
    if (primaryEmailValidation.disposable) alerts.push({ level: "fail", label: "Primary email is disposable" });
    else if (!primaryEmailValidation.format) alerts.push({ level: "fail", label: "Primary email format invalid" });
    else if (!primaryEmailValidation.hasMx) alerts.push({ level: "fail", label: "Primary email domain has no mail server" });
    else if (primaryEmailValidation.deliverability === "UNDELIVERABLE") alerts.push({ level: "fail", label: "Primary email undeliverable" });
    else if (primaryEmailValidation.deliverability === "RISKY") alerts.push({ level: "warn", label: "Primary email risky" });
  }
  // Safety rating
  const ratingLower = String(fmcsaData?.safetyRating || "").toLowerCase();
  if (ratingLower === "conditional") alerts.push({ level: "warn", label: "FMCSA Safety Rating: Conditional" });
  if (ratingLower === "unsatisfactory") alerts.push({ level: "fail", label: "FMCSA Safety Rating: Unsatisfactory" });
  // Out of service
  if (fmcsaData?.outOfService === "Yes") alerts.push({ level: "fail", label: "Carrier is OUT OF SERVICE" });
  // Inactive authority — carrier's operating authority is not active
  if (fmcsaData?.status && fmcsaData.status !== "Active" && fmcsaData?.outOfService !== "Yes") {
    alerts.push({ level: "fail", label: `Carrier authority is ${fmcsaData.status} — NOT authorized to operate` });
  }
  // Inspection history — no inspections is suspicious, high OOS rate is a red flag
  const vehicleInsp = parseInt(String(fmcsaData?.vehicleInspections || "0"), 10);
  const driverInsp = parseInt(String(fmcsaData?.driverInspections || "0"), 10);
  const totalInsp = vehicleInsp + driverInsp;
  const vehicleOosRate = parseFloat(String(fmcsaData?.vehicleOosRate || "0"));
  const vehicleOosNational = parseFloat(String(fmcsaData?.vehicleOosRateNational || "0"));
  const driverOosRate = parseFloat(String(fmcsaData?.driverOosRate || "0"));
  const driverOosNational = parseFloat(String(fmcsaData?.driverOosRateNational || "0"));
  if (fmcsaData && totalInsp === 0) {
    alerts.push({ level: "warn", label: "No vehicle or driver inspections on file — verify carrier activity" });
  }
  // Flag when OOS rate significantly exceeds national average (by 10+ percentage points)
  if (vehicleOosRate > 0 && vehicleOosNational > 0 && vehicleOosRate > vehicleOosNational + 10) {
    alerts.push({ level: "warn", label: `Vehicle OOS rate ${vehicleOosRate.toFixed(1)}% exceeds national avg ${vehicleOosNational.toFixed(1)}%` });
  }
  if (driverOosRate > 0 && driverOosNational > 0 && driverOosRate > driverOosNational + 5) {
    alerts.push({ level: "warn", label: `Driver OOS rate ${driverOosRate.toFixed(1)}% exceeds national avg ${driverOosNational.toFixed(1)}%` });
  }
  // Crashes — any fatal crash is serious; multiple crashes warrant review
  const fatalCrashes = parseInt(String(fmcsaData?.fatalCrashes || "0"), 10);
  const totalCrashes = parseInt(String(fmcsaData?.totalCrashes || "0"), 10);
  if (fatalCrashes > 0) {
    alerts.push({ level: "fail", label: `${fatalCrashes} fatal crash${fatalCrashes === 1 ? "" : "es"} reported (past 24 mo)` });
  } else if (totalCrashes >= 3) {
    alerts.push({ level: "warn", label: `${totalCrashes} crashes reported (past 24 mo)` });
  }
  // Non-USA IP
  if (ipAddress && geoInfo.countryCode && geoInfo.countryCode !== "US") {
    alerts.push({ level: "fail", label: `Submission from outside USA (${geoInfo.country})` });
  }

  const okCount = alerts.filter(a => a.level === "ok").length;
  const warnCount = alerts.filter(a => a.level === "warn").length;
  const failCount = alerts.filter(a => a.level === "fail").length;
  // Overall status
  const overallStatus = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "ok";
  const overallLabel = overallStatus === "ok" ? "All Checks Passed" : overallStatus === "warn" ? "Needs Review" : "Action Required";
  const overallColor = overallStatus === "ok" ? "#22a355" : overallStatus === "warn" ? "#e07000" : "#CC1B1B";
  const overallBg = overallStatus === "ok" ? "#edfaf3" : overallStatus === "warn" ? "#fff8ed" : "#fff5f5";
  const overallIcon = overallStatus === "ok" ? "✓" : overallStatus === "warn" ? "!" : "✗";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f4f5;margin:0;padding:24px 12px;color:#18181b}
.wrap{max-width:680px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)}
.hero{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:28px 32px;color:white}
.hero-label{font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
.hero-title{font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-.5px;line-height:1.2}
.hero-meta{color:#d4d4d8;font-size:13px;margin:0;line-height:1.6}
.hero-meta strong{color:#ffffff}
.status-pill{display:inline-block;margin-top:14px;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.body{padding:28px 32px}
.alert-summary{border:1px solid #e4e4e7;border-radius:10px;padding:18px 20px;margin-bottom:24px;background:white}
.alert-summary-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #f4f4f5}
.alert-summary-title{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#18181b}
.alert-counts{display:flex;gap:10px}
.alert-count{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700}
.alert-list{margin:0;padding:0;list-style:none}
.alert-item{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px}
.alert-icon{width:20px;height:20px;border-radius:50%;display:inline-block;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:white;flex-shrink:0}
.pdf-note{background:#eef2ff;border-left:3px solid #6366f1;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#3730a3;line-height:1.5}
.pdf-note strong{color:#312e81}
.sec{margin-bottom:22px;border:1px solid #e4e4e7;border-radius:10px;overflow:hidden}
.sec-hdr{background:#fafafa;padding:12px 18px;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#71717a;border-bottom:1px solid #e4e4e7;display:flex;align-items:center;gap:8px}
.sec-body{padding:18px 20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}
.f .lbl{font-size:10px;font-weight:700;text-transform:uppercase;color:#a1a1aa;margin-bottom:3px;letter-spacing:.06em}
.f .val{font-size:14px;color:#18181b;line-height:1.5}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.02em}
.bg{background:#edfaf3;color:#22a355;border:1px solid #22a355}
.br{background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B}
.bn{background:#f4f4f5;color:#71717a;border:1px solid #e4e4e7}
.doc-list{width:100%;border-collapse:collapse}
.doc-list tr{border-bottom:1px solid #f4f4f5}
.doc-list tr:last-child{border-bottom:none}
.ftr{background:#fafafa;border-top:1px solid #e4e4e7;padding:18px 32px;font-size:11px;color:#a1a1aa;text-align:center;letter-spacing:.02em}
</style></head><body>
<div class="wrap">

<!-- ── HERO HEADER ── -->
<div style="background:#1a1a1a;padding:28px 32px">
  <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">🚛 New Carrier Onboarding</div>
  <h1 style="font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-.5px;line-height:1.2;color:#ffffff">${name}</h1>
  <p style="color:#d4d4d8;font-size:13px;margin:0;line-height:1.6">
    ${(() => {
      const mcLink = hasMc
        ? `<a href="https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=${mcDigits}" target="_blank" style="color:#ffffff;text-decoration:underline;font-weight:700">${mcDigits}</a>`
        : "";
      const dotLink = hasDot
        ? `<a href="https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dotDigits}" target="_blank" style="color:#ffffff;text-decoration:underline;font-weight:700">${dotDigits}</a>`
        : `<strong style="color:#ffffff">—</strong>`;
      const mcPart = hasMc ? `MC# ${mcLink} &nbsp;·&nbsp; ` : "";
      return `${mcPart}DOT# ${dotLink} &nbsp;·&nbsp; <span style="color:#ffffff">${today}</span>`;
    })()}
    ${(companyData?.city || companyData?.state) ? `<br><span style="color:#9ca3af">📍 Carrier: <span style="color:#ffffff">${[companyData?.city, companyData?.state].filter(Boolean).join(", ")}</span></span>` : ""}
    ${ipAddress ? (() => {
      const ipLoc = [geoInfo.city, geoInfo.region].filter(Boolean).join(", ");
      const isUSA = !geoInfo.countryCode || geoInfo.countryCode === "US";
      const proxyFlag = geoInfo.proxy && geoInfo.proxy !== "No";
      const ipColor = !isUSA ? "#ff6b6b" : proxyFlag ? "#ffaa00" : "#ffffff";
      return `<br><span style="color:#9ca3af">🌐 Submitted from: <span style="color:${ipColor};font-weight:700">${ipAddress}</span>${ipLoc ? ` · <span style="color:${ipColor}">${ipLoc}${!isUSA && geoInfo.country ? `, ${geoInfo.country}` : ""}</span>` : ""}${proxyFlag ? ` · <strong style="color:#ff6b6b">🚩 PROXY/VPN</strong>` : ""}</span>`;
    })() : ""}
    ${(fmcsaData?.mcs150Date && fmcsaData.mcs150Date !== "Current") ? `<br><span style="color:#9ca3af">📋 MCS-150 filed: <span style="color:#ffffff">${fmcsaData.mcs150Date as string}</span></span>` : ""}
  </p>
  <div style="display:inline-block;margin-top:14px;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:${overallBg};color:${overallColor}">
    ${overallIcon}&nbsp; ${overallLabel}
  </div>
</div>

${(() => {
  // Red full-width banner ONLY for non-USA submissions (duplicate of header but more prominent)
  if (!ipAddress) return "";
  const isUSA = !geoInfo.countryCode || geoInfo.countryCode === "US";
  if (!isUSA) {
    return `<div style="background:#CC1B1B;padding:14px 32px;text-align:center">
  <div style="font-size:16px;font-weight:900;color:white;letter-spacing:.5px">
    🚩 SUBMITTED FROM OUTSIDE USA (${geoInfo.country || "unknown"}) — VERIFY IMMEDIATELY 🚩
  </div>
</div>`;
  }
  return "";
})()}

${(() => {
  // Conditional/Unsatisfactory safety rating banner (full width below header)
  const rating = (fmcsaData?.safetyRating as string) || "";
  const r = rating.toLowerCase();
  if (r.includes("conditional") || r.includes("unsatisfactory")) {
    const label = r.includes("unsatisfactory") ? "UNSATISFACTORY" : "CONDITIONAL";
    return `<div style="background:#CC1B1B;padding:14px 32px;text-align:center">
  <div style="font-size:15px;font-weight:900;color:white;letter-spacing:.5px">
    ⚠️ &nbsp;WARNING: ${label} SAFETY RATING
  </div>
  <div style="color:#ffe0e0;font-size:12px;font-weight:600;margin-top:3px">
    This carrier has a <strong style="color:white">${rating.toUpperCase()}</strong> FMCSA safety rating — review carefully
  </div>
</div>`;
  }
  return "";
})()}

<div class="body">

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--  ALERTS — at top for immediate visibility                                -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="sec">
  <div class="sec-hdr" style="${failCount > 0 ? "background:#fff5f5;color:#CC1B1B;border-color:#CC1B1B" : warnCount > 0 ? "background:#fff8ed;color:#e07000;border-color:#e07000" : "background:#edfaf3;color:#22a355;border-color:#22a355"}">
    ${failCount > 0 ? "⚠ Alerts — Action Required" : warnCount > 0 ? "⚠ Alerts — Needs Review" : "✓ Alerts — All Clear"}
    <span style="margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.04em">
      ${warnCount > 0 ? `<span style="color:#e07000">${warnCount} warning${warnCount === 1 ? "" : "s"}</span>` : ""}
      ${warnCount > 0 && failCount > 0 ? ` &nbsp;·&nbsp; ` : ""}
      ${failCount > 0 ? `<span style="color:#CC1B1B">${failCount} issue${failCount === 1 ? "" : "s"}</span>` : ""}
    </span>
  </div>
  <div class="sec-body" style="padding:14px 20px">
    ${alerts.length === 0 ? `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px"><span class="alert-icon" style="background:#22a355">✓</span><span style="color:#166534">No alerts — all checks passed</span></div>` : `<ul class="alert-list">
      ${alerts.map(a => {
        const bg = a.level === "ok" ? "#22a355" : a.level === "warn" ? "#e07000" : "#CC1B1B";
        const ic = a.level === "ok" ? "✓" : a.level === "warn" ? "!" : "✗";
        const col = a.level === "ok" ? "#166534" : a.level === "warn" ? "#92400e" : "#991b1b";
        return `<li class="alert-item"><span class="alert-icon" style="background:${bg}">${ic}</span><span style="color:${col};font-weight:${a.level === "ok" ? 500 : 600}">${a.label}</span></li>`;
      }).join("")}
    </ul>`}
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--  SECTION 1: CARRIER INFORMATION                                          -->
<!--  Consolidates company info, contact, equipment, authority, insurance,   -->
<!--  and agreement/signature into ONE well-organized section                 -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="sec">
  <div class="sec-hdr">🏢 Carrier Information</div>
  <div class="sec-body">
    <div class="grid">
      <!-- ── Column distribution: simple 2-col grid, sub-grouped by topic ── -->

      <!-- Identity -->
      <div class="f"><div class="lbl">Legal Name</div><div class="val" style="font-weight:700">${name}</div></div>
      <div class="f"><div class="lbl">DBA</div><div class="val">${(companyData?.dba as string) || "—"}</div></div>
      ${hasMc ? `<div class="f"><div class="lbl">MC #</div><div class="val"><a href="https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=${mcDigits}" target="_blank" style="color:#0066cc;text-decoration:none;font-weight:700">${mcDigits} ↗</a></div></div>` : ""}
      <div class="f"><div class="lbl">DOT #</div><div class="val">${hasDot
        ? `<a href="https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dotDigits}" target="_blank" style="color:#0066cc;text-decoration:none;font-weight:700">${dotDigits} ↗</a>${likelyIntrastate ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff8ed;color:#e07000;border:1px solid #e07000">⚠ LIKELY INTRASTATE</span>` : ""}`
        : "—"
      }</div></div>
      <div class="f"><div class="lbl">EIN / Tax ID</div><div class="val">${(() => {
        const userEin = ((companyData?.ein as string) || "").replace(/[^0-9]/g, "");
        const fmcsaEin = ((fmcsaData?.fmcsaEin as string) || "").replace(/[^0-9]/g, "");
        const display = (companyData?.ein as string) || "—";
        if (!userEin) return display;
        if (!fmcsaEin) return `${display} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#f5f5f5;color:#888;border:1px solid #ddd">FMCSA: N/A</span>`;
        if (userEin === fmcsaEin) return `${display} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ MATCHES</span>`;
        return `${display} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ MISMATCH (FMCSA: ${fmcsaEin.slice(0,2)}-${fmcsaEin.slice(2)})</span>`;
      })()}</div></div>
      <div class="f"><div class="lbl">Authority Status</div><div class="val">${(() => {
        const f = (fmcsaData || {}) as Record<string, string>;
        const oos = f.outOfService === "Yes";
        if (oos) return `<strong style="color:#CC1B1B">⚠ OUT OF SERVICE</strong>`;
        if (f.safetyRating) {
          const r = f.safetyRating.toLowerCase();
          const color = r.includes("unsatisfactory") ? "#CC1B1B" : r.includes("conditional") ? "#e07000" : "#22a355";
          // For Conditional, show the safety review date right alongside so the reviewer can see how old it is
          const reviewDateSuffix = r.includes("conditional") && f.safetyReviewDate
            ? ` <span style="color:#e07000;font-size:11px;font-weight:600">(reviewed ${f.safetyReviewDate}${f.safetyReviewType ? `, ${f.safetyReviewType}` : ""})</span>`
            : "";
          return `<strong style="color:${color}">${f.safetyRating}</strong>${reviewDateSuffix}`;
        }
        return "Active &nbsp;<span style='color:#888;font-size:11px'>(Not Rated)</span>";
      })()}</div></div>

      <!-- Primary Contact -->
      <div class="f"><div class="lbl">Primary Contact</div><div class="val" style="font-weight:700">${(companyData?.contactName as string) || "—"}</div></div>
      <div class="f"><div class="lbl">Primary Phone</div><div class="val">${(() => {
        const userPhone = ((companyData?.phone as string) || "").replace(/[^0-9]/g, "");
        const fmcsaPhone = ((fmcsaData?.phone as string) || "").replace(/[^0-9]/g, "");
        const display = (companyData?.phone as string) || "—";
        if (!userPhone) return display;
        const typeBadge = phoneTypeInfo
          ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff;color:${phoneTypeInfo.color};border:1px solid ${phoneTypeInfo.color}">${phoneTypeInfo.badge}${phoneTypeInfo.carrier ? ` · ${phoneTypeInfo.carrier}` : ""}</span>`
          : "";
        if (fmcsaPhone && userPhone === fmcsaPhone) {
          return `${display}${typeBadge} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ MATCHES</span>`;
        }
        if (fmcsaPhone && userPhone !== fmcsaPhone) {
          const fmtFmcsa = fmcsaPhone.length === 10 ? `${fmcsaPhone.slice(0,3)}-${fmcsaPhone.slice(3,6)}-${fmcsaPhone.slice(6)}` : fmcsaPhone;
          return `<span style="color:#CC1B1B;font-weight:700">${display}</span>${typeBadge} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ CHANGED — FMCSA: ${fmtFmcsa}</span>`;
        }
        return `${display}${typeBadge}`;
      })()}</div></div>
      ${dispatchDigits && !sameAsPrimary ? `<div class="f"><div class="lbl">Dispatch Phone</div><div class="val">${dispatchPhone}${dispatchPhoneTypeInfo ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff;color:${dispatchPhoneTypeInfo.color};border:1px solid ${dispatchPhoneTypeInfo.color}">${dispatchPhoneTypeInfo.badge}${dispatchPhoneTypeInfo.carrier ? ` · ${dispatchPhoneTypeInfo.carrier}` : ""}</span>` : ""}</div></div>` : ""}
      <div class="f"><div class="lbl">Primary Email</div><div class="val">${(() => {
        const userEmail = primaryEmail.toLowerCase();
        const fmcsaEmail = ((fmcsaData?.email as string) || "").trim().toLowerCase();
        const display = primaryEmail || "—";
        if (!userEmail) return display;
        const validBadge = emailBadgeHtml(primaryEmailValidation);
        if (!fmcsaEmail) return `${display}${validBadge}`;
        if (userEmail === fmcsaEmail) return `${display}${validBadge} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ MATCHES</span>`;
        return `<span style="color:#CC1B1B;font-weight:700">${display}</span>${validBadge} <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ CHANGED — FMCSA: ${fmcsaEmail}</span>`;
      })()}</div></div>
      ${dispatchEmail && !sameEmail ? `<div class="f"><div class="lbl">Dispatch Email</div><div class="val">${dispatchEmail}${emailBadgeHtml(dispatchEmailValidation)}</div></div>` : ""}
      ${billingEmail && !billingSameAsPrimary && !billingSameAsDispatch ? `<div class="f"><div class="lbl">Billing Email</div><div class="val">${billingEmail}${emailBadgeHtml(billingEmailValidation)}</div></div>` : ""}
      ${agentEmail ? (() => {
        const a = agentEmail.toLowerCase();
        if (a === primaryEmail.toLowerCase() || a === dispatchEmail.toLowerCase() || a === billingEmail.toLowerCase()) {
          return `<div class="f"><div class="lbl">COI Agent Email</div><div class="val"><span style="color:#888">${agentEmail}</span> <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff8ed;color:#e07000;border:1px solid #e07000">⚠ SAME AS CARRIER</span></div></div>`;
        }
        return `<div class="f"><div class="lbl">COI Agent Email</div><div class="val">${agentEmail}${emailBadgeHtml(agentEmailValidation)}</div></div>`;
      })() : ""}

      <!-- Equipment -->
      <div class="f"><div class="lbl">Power Units (Trucks)</div><div class="val">${(companyData?.truckCount as string) || "—"}${(fmcsaData?.truckCount && (fmcsaData.truckCount as string) !== (companyData?.truckCount as string)) ? ` <span style="color:#888;font-size:11px">(FMCSA: ${fmcsaData.truckCount as string})</span>` : ""}</div></div>
      <div class="f"><div class="lbl">Trailers</div><div class="val">${(companyData?.trailerCount as string) || "—"}</div></div>
      <div class="f" style="grid-column:1/-1"><div class="lbl">Trailer Types</div><div class="val">${trailers}</div></div>
      ${(() => {
        // FMCSA-declared cargo types — list them all, highlighting whether Refrigerated Food is present
        const cargoArr = (fmcsaData?.cargoCarried as string[]) || [];
        if (cargoArr.length === 0) {
          return `<div class="f" style="grid-column:1/-1"><div class="lbl">FMCSA Cargo Types</div><div class="val"><span style="color:#e07000;font-weight:600">⚠ None declared</span></div></div>`;
        }
        const hasReefer = cargoArr.some(c => /refrigerated\s*food/i.test(c));
        const list = cargoArr.map(c => {
          const isReefer = /refrigerated\s*food/i.test(c);
          return isReefer
            ? `<span style="background:#edfaf3;color:#22a355;padding:1px 6px;border-radius:6px;font-weight:700">${c}</span>`
            : c;
        }).join(", ");
        const flag = !hasReefer
          ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff8ed;color:#e07000;border:1px solid #e07000">⚠ NO REFRIGERATED FOOD</span>`
          : "";
        return `<div class="f" style="grid-column:1/-1"><div class="lbl">FMCSA Cargo Types</div><div class="val">${list}${flag}</div></div>`;
      })()}
      ${(fmcsaData?.operationClass) ? `<div class="f"><div class="lbl">Operation Class</div><div class="val">${fmcsaData.operationClass as string}</div></div>` : ""}
      ${fmcsaData?.hazmatFlag === "Yes" ? `<div class="f"><div class="lbl">Hazmat</div><div class="val"><strong style="color:#CC1B1B">⚠ Yes</strong></div></div>` : ""}

      <!-- Payment Preferences -->
      <div class="f"><div class="lbl">Quick Pay</div><div class="val">${companyData?.wantsQuickPay ? '<span class="badge bg">✓ Yes (5% fee)</span>' : '<span class="badge bn">No</span>'}</div></div>
      <div class="f"><div class="lbl">Factoring</div><div class="val">${companyData?.usesFactoring ? `<span class="badge br">Yes — ${(companyData?.factoringName as string) || ""}</span>` : '<span class="badge bn">No</span>'}</div></div>

      <!-- Insurance Filings (FMCSA) -->
      ${(() => {
        const f = (fmcsaData || {}) as Record<string, string>;
        const hasAny = f.bipdInsuranceOnFile || f.cargoInsuranceOnFile || f.bondInsuranceOnFile ||
          f.bipdInsuranceRequired || f.cargoInsuranceRequired || f.bondInsuranceRequired;
        if (!hasAny) return "";
        // FMCSA stores insurance amounts in thousands of dollars.
        // e.g. bipdInsuranceOnFile = "1000" means $1,000,000 ($1M); "750" means $750,000 ($750K).
        // Broker bond minimum is $75,000 (value of 75); BIPD minimum is $750,000 (value of 750).
        const fmt = (v: string) => {
          const n = parseInt(String(v || "").replace(/[^0-9]/g, ""), 10);
          if (!n) return "";
          if (n >= 1000) return `$${(n / 1000).toFixed(0)}M`;   // 1000 thousand = $1M
          return `$${n}K`;                                      // 750 thousand = $750K, 75 thousand = $75K
        };
        const insRow = (onFile: string, required: string, label: string) => {
          if (!onFile && !required) return "";
          const onFileFmt = fmt(onFile);
          const requiredFmt = fmt(required);
          const onFileN = parseInt(String(onFile || "").replace(/[^0-9]/g, ""), 10) || 0;
          const requiredN = parseInt(String(required || "").replace(/[^0-9]/g, ""), 10) || 0;
          let status = "";
          if (requiredN > 0 && onFileN >= requiredN) {
            status = ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#edfaf3;color:#22a355;border:1px solid #22a355">✓ FILED</span>`;
          } else if (requiredN > 0 && onFileN === 0) {
            status = ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff5f5;color:#CC1B1B;border:1px solid #CC1B1B">⚠ NOT ON FILE</span>`;
          } else if (requiredN > 0 && onFileN > 0 && onFileN < requiredN) {
            status = ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff8ed;color:#e07000;border:1px solid #e07000">⚠ UNDERINSURED</span>`;
          }
          const parts = [
            onFileFmt ? `On file: <strong>${onFileFmt}</strong>` : "",
            requiredFmt ? `<span style="color:#888">Req: ${requiredFmt}</span>` : "",
          ].filter(Boolean).join(" · ") || "—";
          return `<div class="f"><div class="lbl">${label}</div><div class="val">${parts}${status}</div></div>`;
        };
        return insRow(f.bipdInsuranceOnFile, f.bipdInsuranceRequired || f.bipdRequiredAmount, "Liability (BIPD)")
          + insRow(f.cargoInsuranceOnFile, f.cargoInsuranceRequired, "Cargo Insurance")
          + insRow(f.bondInsuranceOnFile, f.bondInsuranceRequired, "Broker Bond");
      })()}

      <!-- Inspection History (FMCSA — past 24 months) — counts only, % only appears in alerts -->
      ${(() => {
        const f = (fmcsaData || {}) as Record<string, string>;
        const vInsp = parseInt(f.vehicleInspections || "0", 10);
        const dInsp = parseInt(f.driverInspections || "0", 10);
        const hInsp = parseInt(f.hazmatInspections || "0", 10);
        const vOos = parseInt(f.vehicleOosInspections || "0", 10);
        const dOos = parseInt(f.driverOosInspections || "0", 10);
        const totalInsp = vInsp + dInsp + hInsp;
        // Always render these rows (even when counts are 0) so the reviewer can clearly see "0 inspections" vs missing data
        // Skip only if FMCSA didn't return the field at all (carrier not in FMCSA database)
        if (!f.vehicleInspections && !f.driverInspections) return "";

        const zeroAlert = totalInsp === 0
          ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff8ed;color:#e07000;border:1px solid #e07000">⚠ NO INSPECTIONS</span>`
          : "";
        const oosVeh = vOos > 0 ? ` &nbsp;·&nbsp; <span style="color:#CC1B1B;font-weight:700">${vOos} OOS</span>` : "";
        const oosDr = dOos > 0 ? ` &nbsp;·&nbsp; <span style="color:#CC1B1B;font-weight:700">${dOos} OOS</span>` : "";

        let rows = `<div class="f"><div class="lbl">Vehicle Inspections (24 mo)</div><div class="val"><strong>${vInsp}</strong>${oosVeh}${totalInsp === 0 ? zeroAlert : ""}</div></div>`;
        rows += `<div class="f"><div class="lbl">Driver Inspections (24 mo)</div><div class="val"><strong>${dInsp}</strong>${oosDr}</div></div>`;
        if (hInsp > 0) {
          const hOos = parseInt(f.hazmatOosInspections || "0", 10);
          rows += `<div class="f"><div class="lbl">Hazmat Inspections (24 mo)</div><div class="val"><strong>${hInsp}</strong>${hOos > 0 ? ` &nbsp;·&nbsp; <span style="color:#CC1B1B;font-weight:700">${hOos} OOS</span>` : ""}</div></div>`;
        }
        // ISS (Inspection Selection System) score — FMCSA's likelihood-of-roadside-inspection score
        if (f.issScore) {
          rows += `<div class="f"><div class="lbl">ISS Score</div><div class="val">${f.issScore}</div></div>`;
        }
        return rows;
      })()}

      <!-- Crash History (FMCSA — only shown if 1+ crash reported) -->
      ${(() => {
        const f = (fmcsaData || {}) as Record<string, string>;
        const total = parseInt(f.totalCrashes || "0", 10);
        if (total === 0) return "";
        const fatal = parseInt(f.fatalCrashes || "0", 10);
        const injury = parseInt(f.injuryCrashes || "0", 10);
        const towaway = parseInt(f.towawayCrashes || "0", 10);
        const color = fatal > 0 ? "#CC1B1B" : total >= 3 ? "#e07000" : "#27272a";
        const parts: string[] = [];
        if (fatal > 0) parts.push(`<strong style="color:#CC1B1B">${fatal} fatal</strong>`);
        if (injury > 0) parts.push(`${injury} injury`);
        if (towaway > 0) parts.push(`${towaway} tow-away`);
        const breakdown = parts.length > 0 ? ` &nbsp;(${parts.join(" · ")})` : "";
        return `<div class="f" style="grid-column:1/-1"><div class="lbl">Crashes (24 mo)</div><div class="val"><strong style="color:${color}">${total}</strong>${breakdown}</div></div>`;
      })()}

      <!-- Agreement & Signature -->
      <div class="f" style="grid-column:1/-1;border-top:1px solid #e4e4e7;padding-top:12px;margin-top:4px"><div class="lbl">Agreement Signed By</div><div class="val"><strong>${sig.signerName as string || "—"}</strong>${sig.signerTitle ? `, ${sig.signerTitle as string}` : ""} &nbsp;<span style="color:#888;font-size:12px">on ${today}</span></div></div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--  ADDRESS LOCATION VERIFICATION (Google Maps — Street View + Aerial)     -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- ── CARRIER ADDRESS LOOKUP (Google Maps) ── -->
${(() => {
  const gKey = process.env.GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_MAPS_API_KE
    || process.env.GOOGLE_MAPS_KEY;
  if (!gKey) {
    console.warn("[submit] GOOGLE_MAPS_API_KEY not set — skipping Street View section");
    return "";
  }

  // Helper: build the images + links block for a single address
  const buildAddressBlock = (label: string, addr: string) => {
    const encoded = encodeURIComponent(addr);
    const streetImgUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encoded}&fov=90&key=${gKey}`;
    const mapImgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=18&size=600x300&maptype=satellite&markers=color:red%7C${encoded}&key=${gKey}`;
    const streetViewLink = `https://www.google.com/maps/search/?api=1&query=${encoded}&layer=c`;
    const satelliteLink = `https://www.google.com/maps/@?api=1&map_action=map&basemap=satellite&center=${encoded}&zoom=18`;
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    return `
  <div style="margin-top:14px;padding-top:12px;border-top:1px solid #eee">
    <div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">${label}</div>
    <div style="text-align:center;margin-bottom:10px;color:#555;font-size:12px"><strong>${addr}</strong> &nbsp;·&nbsp; <a href="${googleMapsLink}" style="color:#CC1B1B;text-decoration:none;font-weight:700">Open in Google Maps →</a></div>
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
  </div>`;
  };

  // Physical address
  const physAddr = [companyData?.address, companyData?.city, companyData?.state, companyData?.zip].filter(Boolean).join(", ");
  if (!physAddr) return "";

  // Mailing address — only map if it's an actual street (skip PO Boxes)
  const mailing = (companyData?.mailing as Record<string, string>) || {};
  const mailingStreet = mailing.address || "";
  const isPoBox = /^\s*(p\.?\s*o\.?\s*box|post\s*office\s*box)/i.test(mailingStreet);
  const mailingAddr = mailingStreet && !isPoBox
    ? [mailingStreet, mailing.city, mailing.state, mailing.zip].filter(Boolean).join(", ")
    : "";
  // Also skip if mailing matches physical (no need to show twice)
  const mailingDiffers = mailingAddr && mailingAddr.toLowerCase() !== physAddr.toLowerCase();

  return `<div class="sec"><div class="sec-hdr">📍 Address Location Verification</div><div class="sec-body">
    <div style="text-align:center;margin-bottom:10px;color:#888;font-size:11px;font-style:italic">Click any image to open the interactive view in Google Maps. If images don't display, click "Display images" in your email client.</div>
    ${buildAddressBlock("Physical Address", physAddr)}
    ${mailingDiffers ? buildAddressBlock("Mailing Address", mailingAddr) : ""}
  </div></div>`;
})()}

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!--  SECTION 3: DOCUMENT STATUS                                              -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->
<div class="sec">
  <div class="sec-hdr">📋 Document Status</div>
  <table class="doc-list">
    ${checkRow(agreementSigned, "Carrier Agreement Signed", agreementSigned ? `Signed by ${sig.signerName as string}${sig.signerTitle ? `, ${sig.signerTitle as string}` : ""}` : "Not signed")}
    ${checkRow(wcOk, wcLabel, !wcOk ? "Workers comp documentation missing" : undefined)}
    ${checkRow(w9Ok, w9Label, !w9Ok ? "W-9 not provided" : undefined)}
    ${checkRow(coiUploaded ? true : coiAgentNotified ? "warn" : false, coiLabel, coiDetail ?? (!coiUploaded && !coiAgentNotified ? "Certificate of insurance not received" : undefined))}
  </table>
</div>

<div class="pdf-note">📎 <strong>Two PDFs attached:</strong> Onboarding Packet (carrier profile, workers comp, signed agreement) &nbsp;·&nbsp; Supporting Documents (uploaded files, processed &amp; compressed)</div>

<!-- ── THANK YOU FOOTER ── -->
<div style="margin:28px 0 0;padding:20px 24px;background:linear-gradient(135deg,#fafafa 0%,#f4f4f5 100%);border:1px solid #e4e4e7;border-radius:10px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="90" style="vertical-align:middle;padding-right:16px">
        <img src="https://setup.simonexpress.com/youdidthat.png" alt="You did that!" width="90" style="display:block;width:90px;max-width:90px;height:auto" />
      </td>
      <td style="vertical-align:middle">
        <div style="font-size:13px;line-height:1.5;color:#27272a">
          By checking all the alerts and properly vetting carriers you may have stopped potential fraud.
          <div style="margin-top:6px;font-size:12px;color:#71717a;font-style:italic">
            Thank you from the management at Simon Express.
          </div>
        </div>
      </td>
    </tr>
  </table>
</div>

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
        html: buildCarrierConfirmEmail(companyName, today, (((companyData?.mc as string) || (fmcsaData?.mc as string) || "").replace(/[^0-9]/g, "") || undefined), (((companyData?.dot as string) || (fmcsaData?.dot as string) || "").replace(/[^0-9]/g, "") || undefined)),
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
