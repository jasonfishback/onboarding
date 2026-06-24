// src/lib/saferwatch.ts
//
// SaferWatch lookup for the onboarding dispatch email: pulls the data FMCSA
// doesn't give (email/contacts, detailed insurance + AM Best + the insurance
// producer/agent, RiskAssessment + CSA BASIC, trailer/cargo), renders an email
// section, and fetches the COI certificate as a PDF attachment.
//
// Mirrors kpi's lib/carriers/saferwatch.ts parser (kept identical). Keys via env
// SAFERWATCH_SERVICE_KEY / SAFERWATCH_CUSTOMER_KEY.

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const ENDPOINT = "https://www.saferwatch.com/webservices/CarrierService31.php";

export interface SwPolicy {
  insurer: string | null; type: string | null; policyNumber: string | null;
  coverageTo: string | null; effectiveDate: string | null; amBest: string | null;
}
export interface SwCertificate {
  certificateId: string | null; producerName: string | null; producerCity: string | null;
  producerState: string | null; producerPhone: string | null; producerEmail: string | null;
}
export interface SaferWatchSnapshot {
  number: string; legalName: string | null; carrierType: string | null;
  email: string | null; rep1: string | null; rep2: string | null; mailingPhone: string | null;
  organization: string | null; dunBradstreet: string | null;
  commonAuthority: string | null; contractAuthority: string | null; brokerAuthority: string | null;
  policies: SwPolicy[]; certDataStatus: string | null; certificates: SwCertificate[];
  safetyRating: string | null; riskOverall: string | null; riskSafety: string | null;
  trailersOwned: string | null; trucksTotal: string | null; driversTotal: string | null;
  cargoTypes: string[];
  status: string | null;
}

const CARGO_LABELS: Record<string, string> = {
  cargoGenFreight: "General Freight", cargoRefrigerated: "Refrigerated", cargoDryBulk: "Dry Bulk",
  cargoLiqGas: "Liquids/Gases", cargoIntermodal: "Intermodal", cargoMotorVeh: "Motor Vehicles",
  cargoLogPole: "Logs/Poles", cargoBldgMaterial: "Building Materials", cargoMachLarge: "Machinery",
  cargoProduce: "Produce", cargoLivestock: "Livestock", cargoGrainfeed: "Grain/Feed", cargoMeat: "Meat",
  cargoChemicals: "Chemicals", cargoBeverages: "Beverages", cargoPaperProd: "Paper", cargoMetal: "Metal",
  cargoHousehold: "Household Goods", cargoOilfield: "Oil Field", cargoConstruction: "Construction",
};

function decode(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
}
function xmlVal(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  const v = decode(m[1]);
  return v === "" ? null : v;
}
function xmlBlocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

export function parseSaferWatch(xml: string, number: string): SaferWatchSnapshot {
  const identity = xmlBlocks(xml, "Identity")[0] ?? xml;
  const auth = xmlBlocks(xml, "Authority")[0] ?? xml;
  const ins = xmlBlocks(xml, "FMCSAInsurance")[0] ?? xml;
  const risk = xmlBlocks(xml, "RiskAssessment")[0] ?? xml;
  const cert = xmlBlocks(xml, "CertData")[0] ?? "";
  return {
    number,
    legalName: xmlVal(identity, "legalName"),
    carrierType: xmlVal(xml, "carrierType"),
    email: xmlVal(identity, "emailAddress"),
    rep1: xmlVal(identity, "companyRep1"),
    rep2: xmlVal(identity, "companyRep2"),
    mailingPhone: xmlVal(identity, "mailingPhone"),
    organization: xmlVal(identity, "organization"),
    dunBradstreet: xmlVal(identity, "dunBradstreetNum"),
    commonAuthority: xmlVal(auth, "commonAuthority"),
    contractAuthority: xmlVal(auth, "contractAuthority"),
    brokerAuthority: xmlVal(auth, "brokerAuthority"),
    policies: xmlBlocks(ins, "PolicyItem").map((p) => ({
      insurer: xmlVal(p, "companyName"), type: xmlVal(p, "insuranceType"), policyNumber: xmlVal(p, "policyNumber"),
      coverageTo: xmlVal(p, "coverageTo"), effectiveDate: xmlVal(p, "effectiveDate"), amBest: xmlVal(p, "amBestRating"),
    })),
    certDataStatus: xmlVal(cert, "status") ?? (cert ? "OK" : null),
    certificates: xmlBlocks(cert, "Certificate").map((c) => ({
      certificateId: xmlVal(c, "certificateID"), producerName: xmlVal(c, "producerName"),
      producerCity: xmlVal(c, "producerCity"), producerState: xmlVal(c, "producerState"),
      producerPhone: xmlVal(c, "producerPhone"), producerEmail: xmlVal(c, "producerEmail"),
    })),
    safetyRating: xmlVal(xml, "rating"),
    riskOverall: xmlVal(risk, "Overall"),
    riskSafety: xmlVal(risk, "Safety"),
    trailersOwned: xmlVal(xml, "trailersOwned"),
    trucksTotal: xmlVal(xml, "trucksTotal"),
    driversTotal: xmlVal(xml, "driversTotal"),
    cargoTypes: Object.entries(CARGO_LABELS)
      .filter(([tag]) => (xmlVal(xml, tag) || "").toLowerCase() === "yes")
      .map(([, label]) => label),
    status: xmlVal(xml, "status"),
  };
}

function keys() {
  return { service: process.env.SAFERWATCH_SERVICE_KEY || "", customer: process.env.SAFERWATCH_CUSTOMER_KEY || "" };
}

export async function saferwatchLookup(number: string): Promise<SaferWatchSnapshot | null> {
  const n = String(number || "").trim();
  const { service, customer } = keys();
  if (!n || !service || !customer) return null;
  const url = `${ENDPOINT}?Action=CarrierLookup&ServiceKey=${encodeURIComponent(service)}&CustomerKey=${encodeURIComponent(customer)}&number=${encodeURIComponent(n)}`;
  try {
    const xml = await (await fetch(url, { cache: "no-store" })).text();
    const snap = parseSaferWatch(xml, n);
    if (snap.status && snap.status.toUpperCase() === "ERROR" && !snap.legalName) return null;
    return snap;
  } catch {
    return null;
  }
}

async function requestCertImageUrl(certificateId: string): Promise<string | null> {
  const { service, customer } = keys();
  if (!certificateId || !service || !customer) return null;
  const url = `${ENDPOINT}?Action=RequestImage&ServiceKey=${encodeURIComponent(service)}&CustomerKey=${encodeURIComponent(customer)}&CertificateId=${encodeURIComponent(certificateId)}`;
  try {
    const xml = await (await fetch(url, { cache: "no-store" })).text();
    const m = xml.match(/<displayMsg>([\s\S]*?)<\/displayMsg>/i);
    const link = m ? decode(m[1]) : "";
    return /^https?:\/\//.test(link) ? link : null;
  } catch {
    return null;
  }
}

/** Fetch a SaferWatch certificate as PDF bytes (pass-through if PDF; image→1-page PDF). */
export async function fetchCertPdf(certificateId: string): Promise<Uint8Array | null> {
  const link = await requestCertImageUrl(certificateId);
  if (!link) return null;
  try {
    const res = await fetch(link, { cache: "no-store" });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (ct.includes("pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50)) return bytes; // %PDF
    // Image → embed into a single-page PDF.
    let imgBytes = bytes;
    let png = ct.includes("png") || bytes[0] === 0x89;
    if (ct.includes("tif") || ct.includes("tiff")) { imgBytes = new Uint8Array(await sharp(Buffer.from(bytes)).png().toBuffer()); png = true; }
    const pdf = await PDFDocument.create();
    const img = png ? await pdf.embedPng(imgBytes) : await pdf.embedJpg(imgBytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    return await pdf.save();
  } catch {
    return null;
  }
}

/** HTML block for the dispatch onboarding email — the SaferWatch extras. */
export function renderSaferWatchSection(sw: SaferWatchSnapshot, registeredEmail?: string): string {
  // ALERT: the email the carrier registered with doesn't match SaferWatch's email
  // on file — a fraud/impostor red flag. Called out in bold at the top.
  const norm = (e?: string | null) => String(e || "").trim().toLowerCase();
  const emailMismatch = !!registeredEmail && !!sw.email && norm(registeredEmail) !== norm(sw.email);
  const mismatchAlert = emailMismatch
    ? `<div style="background:#fde8e8;border:2px solid #d71920;border-radius:8px;padding:12px;margin-bottom:12px;font-family:system-ui,sans-serif">
  <strong style="color:#b00000;font-size:14px">⚠ EMAIL MISMATCH — registered email does NOT match SaferWatch</strong>
  <div style="font-size:13px;color:#7a0000;margin-top:4px">Registered: <strong>${registeredEmail}</strong> &nbsp;·&nbsp; SaferWatch on file: <strong>${sw.email}</strong>.<br><strong>Verify this is the real carrier before proceeding.</strong></div>
</div>`
    : "";
  const row = (label: string, val: string | null) =>
    val ? `<tr><td style="padding:3px 12px 3px 0;color:#6B7280;font-size:12px;white-space:nowrap">${label}</td><td style="font-size:13px;color:#18181b">${val}</td></tr>` : "";
  const policies = sw.policies.length
    ? `<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#71717a;margin-bottom:4px">Insurance policies</div>${sw.policies.map((p) =>
        `<div style="font-size:13px;color:#18181b;margin-bottom:2px">${p.insurer || "—"}${p.type ? ` · ${p.type}` : ""}${p.coverageTo ? ` · $${p.coverageTo}` : ""}${p.amBest ? ` · AM Best ${p.amBest}` : ""}${p.effectiveDate ? ` · eff ${p.effectiveDate}` : ""}</div>`).join("")}</div>`
    : "";
  const agent = sw.certificates.find((c) => c.producerName);
  const agentHtml = agent
    ? `<div style="margin-top:8px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#71717a;margin-bottom:4px">Insurance agent</div><div style="font-size:13px;color:#18181b">${agent.producerName}${agent.producerState ? ` · ${[agent.producerCity, agent.producerState].filter(Boolean).join(", ")}` : ""}${agent.producerPhone ? ` · ${agent.producerPhone}` : ""}${agent.producerEmail ? ` · ${agent.producerEmail}` : ""}</div></div>`
    : "";
  const cargo = sw.cargoTypes.length ? `<div style="margin-top:8px;font-size:13px;color:#18181b"><span style="color:#6B7280">Hauls:</span> ${sw.cargoTypes.join(", ")}</div>` : "";
  return `
<div style="margin:16px 0">
  ${mismatchAlert}
<div style="background:#f0f6ff;border:1px solid #bcd4f6;border-left:4px solid #2563EB;border-radius:8px;padding:14px;font-family:system-ui,sans-serif">
  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#2563EB;margin-bottom:8px">🛡 SaferWatch — extra carrier intel</div>
  <table style="border-collapse:collapse">
    ${row("Risk", sw.riskOverall || sw.riskSafety)}
    ${row("Safety rating", sw.safetyRating)}
    ${row("Authority", [sw.commonAuthority && `Common ${sw.commonAuthority}`, sw.contractAuthority && `Contract ${sw.contractAuthority}`, sw.brokerAuthority && sw.brokerAuthority !== "None" && `Broker ${sw.brokerAuthority}`].filter(Boolean).join(" · ") || null)}
    ${row("Fleet", `${sw.trucksTotal || "?"} pwr · ${sw.trailersOwned || "?"} trailers · ${sw.driversTotal || "?"} drivers`)}
    ${row("Email", sw.email)}
    ${row("Contacts", [sw.rep1, sw.rep2].filter(Boolean).join(", ") || null)}
    ${row("Mailing phone", sw.mailingPhone)}
    ${row("Org / D&B", [sw.organization, sw.dunBradstreet && `D&B ${sw.dunBradstreet}`].filter(Boolean).join(" · ") || null)}
  </table>
  ${policies}${agentHtml}${cargo}
</div>
</div>`;
}
