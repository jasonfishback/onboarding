import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "MC").toUpperCase();
  const raw = searchParams.get("value") || "";
  const value = raw.replace(/[^0-9]/g, "");

  if (value.length < 3) {
    return NextResponse.json({ carrier: null, error: "Too short" });
  }

  const key = process.env.FMCSA_API_KEY;
  if (!key) {
    return NextResponse.json({ carrier: null, error: "API key not configured" });
  }

  const url =
    mode === "MC"
      ? `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${value}?webKey=${key}`
      : `https://mobile.fmcsa.dot.gov/qc/services/carriers/${value}?webKey=${key}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return NextResponse.json({ carrier: null });

    const json = await res.json();
    const c =
      json?.content?.carrier ??
      (Array.isArray(json?.content) ? json.content[0]?.carrier : null);

    if (!c) return NextResponse.json({ carrier: null });

    // Build MC# from prefix+docketNumber, or fall back to value for MC lookups
    let mc = c.prefix && c.docketNumber
      ? `${c.prefix}${c.docketNumber}`
      : mode === "MC" ? `MC${value}` : "";

    // For DOT lookups where MC# wasn't returned directly,
    // try the carrier's operating authority endpoint
    if (mode === "DOT" && !mc && c.dotNumber) {
      try {
        const authRes = await fetch(
          `https://mobile.fmcsa.dot.gov/qc/services/carriers/${c.dotNumber}/authority?webKey=${key}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (authRes.ok) {
          const authJson = await authRes.json();
          const auths = authJson?.content;
          if (Array.isArray(auths) && auths.length > 0) {
            // Find first MC authority
            const mcAuth = auths.find((a: Record<string, string>) => a.prefix === "MC") || auths[0];
            if (mcAuth?.prefix && mcAuth?.docketNumber) {
              mc = `${mcAuth.prefix}${mcAuth.docketNumber}`;
            }
          }
        }
      } catch {
        // Non-critical — DOT-only carriers may not have an MC
      }
    }

    // Fetch officer/registrant name (useful to pre-fill Primary Contact)
    let officerName = "";
    if (c.dotNumber) {
      try {
        const officerRes = await fetch(
          `https://mobile.fmcsa.dot.gov/qc/services/carriers/${c.dotNumber}/officers?webKey=${key}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (officerRes.ok) {
          const officerJson = await officerRes.json();
          // Response can be a single object or array; handle both
          const officerContent = officerJson?.content;
          const officer = Array.isArray(officerContent) ? officerContent[0] : officerContent;
          if (officer) {
            // Common fields: fullName, firstName, middleName, lastName, name
            officerName = officer.fullName || officer.name ||
              [officer.firstName, officer.middleName, officer.lastName].filter(Boolean).join(" ").trim() ||
              "";
          }
        }
      } catch {
        // Non-critical — some carriers don't have officer records exposed
      }
    }

    return NextResponse.json({
      carrier: {
        name: c.legalName || c.dbaName || "",
        dba: c.dbaName || "",
        address: c.phyStreet || "",
        city: c.phyCity || "",
        state: c.phyState || "",
        zip: c.phyZipcode || "",
        phone: c.telephone || "",
        email: c.emailAddress || "",
        dot: String(c.dotNumber || ""),
        mc,
        type: "Motor Carrier",
        status: c.allowedToOperate === "Y" ? "Active" : "Inactive",
        officerName,
        // ── Additional fields from FMCSA census ──
        truckCount: c.totalPowerUnits != null ? String(c.totalPowerUnits) : "",
        driverCount: c.totalDrivers != null ? String(c.totalDrivers) : "",
        mcs150Date: c.mcs150Outdated === "N" ? "Current" : c.mcs150FormDate || "",
        operationClass: c.carrierOperation?.carrierOperationDesc || "",
        hazmatFlag: c.oic === "Y" ? "Yes" : "No",
        safetyRating: c.safetyRating || "",
        safetyRatingDate: c.safetyRatingDate || "",
        reviewDate: c.reviewDate || "",
        outOfService: c.statusCode === "INACTIVE-USDOT" || c.allowedToOperate === "N" ? "Yes" : "No",
        // Cargo/commodity carried (array of cargo types)
        cargoCarried: Array.isArray(c.carrier?.cargoCarried) ? c.carrier.cargoCarried : [],
        source: "fmcsa",
      },
    });
  } catch (err) {
    console.error("[fmcsa] error:", String(err));
    return NextResponse.json({ carrier: null });
  }
}
