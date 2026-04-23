import { NextRequest, NextResponse } from "next/server";
import { buildDispatchEmail } from "@/app/api/submit/route";

export const runtime = "nodejs";

// Preview the dispatch email in your browser without sending anything.
// Usage:
//   /api/preview-email                     → default Simon Express demo data
//   /api/preview-email?mc=889444           → pulls live FMCSA data for MC# 889444
//   /api/preview-email?mc=889444&scenario=clean  → all-clear submission
//   /api/preview-email?mc=889444&scenario=alerts → deliberately problematic submission
//
// The scenario parameter controls which realistic mock data gets injected:
//   - "default" (or omitted): typical legit carrier
//   - "clean":   all documents received, everything matches FMCSA
//   - "alerts":  missing documents + mismatches to showcase the alerts section
//   - "foreign": submission from outside USA to show the red banner
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mc = (searchParams.get("mc") || "024308").trim();
  const scenario = searchParams.get("scenario") || "default";

  // ── Pull live FMCSA data if we can (so the preview reflects real carrier info) ──
  let fmcsaData: Record<string, unknown> | null = null;
  try {
    const origin = req.nextUrl.origin;
    const fmcsaRes = await fetch(`${origin}/api/fmcsa-lookup?mode=MC&value=${encodeURIComponent(mc)}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (fmcsaRes.ok) {
      const data = await fmcsaRes.json();
      fmcsaData = data.carrier || null;
    }
  } catch {
    // If FMCSA lookup fails, fall back to hardcoded demo data
  }

  // Fallback FMCSA data if API fails
  if (!fmcsaData) {
    fmcsaData = {
      name: "DEMO CARRIER LLC",
      dba: "",
      address: "123 Main Street",
      city: "DALLAS",
      state: "TX",
      zip: "75201",
      phone: "2145551234",
      email: "",
      dot: "1234567",
      mc: `MC${mc}`,
      type: "Motor Carrier",
      status: "Active",
      safetyRating: "Satisfactory",
      safetyRatingDate: "2024-03-15",
      operationClass: "Interstate",
      truckCount: "25",
      driverCount: "28",
      hazmatFlag: "No",
      outOfService: "No",
      fmcsaEin: "751234567",
      bipdInsuranceOnFile: "1000",
      bipdInsuranceRequired: "Y",
      bipdRequiredAmount: "750",
      cargoInsuranceOnFile: "100",
      cargoInsuranceRequired: "Y",
      bondInsuranceOnFile: "0",
      bondInsuranceRequired: "N",
    };
  }

  const f = fmcsaData as Record<string, string>;

  // ── Build mock company data, varying based on scenario ──
  const base = {
    legalName: f.name,
    dba: f.dba || "",
    mc: f.mc,
    dot: f.dot,
    ein: f.fmcsaEin ? `${f.fmcsaEin.slice(0,2)}-${f.fmcsaEin.slice(2)}` : "75-1234567",
    address: f.address,
    city: f.city,
    state: f.state,
    zip: f.zip,
    phone: f.phone
      ? `${f.phone.slice(0,3)}-${f.phone.slice(3,6)}-${f.phone.slice(6)}`
      : "214-555-1234",
    email: "dispatch@democarrier.com",
    contactName: "John Smith",
    truckCount: f.truckCount || "15",
    trailerCount: "20",
    trailerTypes: { van: true, reefer: true, flatbed: false },
    dispatch: { phone: "", email: "", address: "" },
    billing: { email: "" },
    wantsQuickPay: false,
    usesFactoring: false,
    factoringName: "",
  };

  let companyData: Record<string, unknown> = base;
  let docsData: Record<string, unknown> = {
    w9Mode: "fill",
    uploads: { w9: "", ins: "coi.pdf", auth: "", factoring: "", check: "" },
    emailSent: false,
    agentEmail: "",
  };
  let sigData: Record<string, unknown> = {
    signerName: "John Smith",
    signerTitle: "President",
    agreed: true,
    signedAt: new Date().toISOString(),
  };
  const wcData = {
    hasWC: true,
    insuranceCarrier: "Travelers",
    policyNumber: "WC-12345",
  };
  let ipAddress = "72.193.84.22";
  let geoInfo: Record<string, string> = {
    city: "Salt Lake City",
    region: "Utah",
    country: "United States",
    countryCode: "US",
    isp: "Comcast Cable",
  };

  if (scenario === "clean") {
    // Already the default happy path
  }

  if (scenario === "alerts") {
    // Intentionally problematic submission
    companyData = {
      ...base,
      ein: "99-9999999",                             // EIN mismatch vs FMCSA
      phone: "555-867-5309",                         // phone mismatch
      email: "freeagent@mailinator.com",             // disposable email
      dispatch: { phone: "888-555-1212", email: "dispatch@mailinator.com", address: "" },
      billing: { email: "billing@tempmailer.com" },
    };
    docsData = {
      w9Mode: "upload",
      uploads: { w9: "", ins: "", auth: "", factoring: "", check: "" },  // nothing uploaded
      emailSent: true,
      agentEmail: "freeagent@mailinator.com",
    };
    sigData = { signerName: "", signerTitle: "", signedAt: "" };   // not signed
  }

  if (scenario === "foreign") {
    ipAddress = "185.220.101.5";
    geoInfo = {
      city: "Moscow",
      region: "Moskva",
      country: "Russia",
      countryCode: "RU",
      isp: "TOR Exit Node",
      proxy: "yes",
    };
  }

  const html = await buildDispatchEmail({
    companyData,
    fmcsaData,
    docsData,
    wcData,
    sigData,
    ipAddress,
    geoInfo,
  });

  // Return rendered HTML directly to the browser
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
