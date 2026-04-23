import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Proxy to Google Places Autocomplete so the API key stays server-side.
// GET /api/places?mode=suggest&q=1121+w+2100 → returns predictions
// GET /api/places?mode=details&placeId=xxx   → returns full address components
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "suggest";
  const gKey = process.env.GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_MAPS_API_KE
    || process.env.GOOGLE_MAPS_KEY;

  if (!gKey) {
    return NextResponse.json({ error: "Maps API key not configured" }, { status: 500 });
  }

  try {
    if (mode === "suggest") {
      const q = (searchParams.get("q") || "").trim();
      if (q.length < 3) return NextResponse.json({ predictions: [] });

      // Google Places Autocomplete API (new "Places API (New)" format)
      const url = `https://places.googleapis.com/v1/places:autocomplete`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": gKey,
        },
        body: JSON.stringify({
          input: q,
          includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
          regionCode: "us",
          languageCode: "en",
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("[places/suggest] Google API error:", res.status, errorText.slice(0, 200));
        return NextResponse.json({ predictions: [], error: "lookup failed" });
      }
      const data = await res.json();
      // Normalize to a simpler shape for the client
      const predictions = (data.suggestions || []).map((s: { placePrediction?: { placeId: string; text: { text: string } } }) => ({
        placeId: s.placePrediction?.placeId || "",
        description: s.placePrediction?.text?.text || "",
      })).filter((p: { placeId: string }) => p.placeId);
      return NextResponse.json({ predictions });
    }

    if (mode === "details") {
      const placeId = (searchParams.get("placeId") || "").trim();
      if (!placeId) return NextResponse.json({ error: "placeId required" }, { status: 400 });

      // Fetch full place details
      const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
      const res = await fetch(url, {
        headers: {
          "X-Goog-Api-Key": gKey,
          "X-Goog-FieldMask": "addressComponents,formattedAddress,location",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("[places/details] Google API error:", res.status, errorText.slice(0, 200));
        return NextResponse.json({ error: "lookup failed" }, { status: 500 });
      }
      const data = await res.json();

      // Parse address components into street, city, state, zip
      const comps = (data.addressComponents || []) as Array<{ types: string[]; shortText?: string; longText?: string }>;
      const find = (type: string, useShort = false) => {
        const c = comps.find(x => x.types.includes(type));
        return c ? (useShort ? c.shortText : c.longText) || "" : "";
      };
      const streetNumber = find("street_number");
      const route = find("route");
      const subpremise = find("subpremise");
      const street = [streetNumber, route, subpremise ? `#${subpremise}` : ""].filter(Boolean).join(" ").trim();
      const city = find("locality") || find("sublocality") || find("neighborhood");
      const state = find("administrative_area_level_1", true); // short "UT" vs long "Utah"
      const zip = find("postal_code");

      return NextResponse.json({
        street,
        city,
        state,
        zip,
        formatted: data.formattedAddress || "",
      });
    }

    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  } catch (e) {
    console.error("[places] error:", String(e));
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
