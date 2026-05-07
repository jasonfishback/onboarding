"use client";

import { useState } from "react";
import { Box, Btn, RED, DARK } from "@/components/ui";

export interface CarrierData {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  dot: string;
  mc: string;
  type: string;
  status: string;
  dba?: string;
  safetyRating?: string;
  safetyRatingDate?: string;
  insuranceOnFile?: string;
  cargoInsOnFile?: string;
  totalDrivers?: string;
  totalPowerUnits?: string;
  truckCount?: string;
  driverCount?: string;
  mcs150Date?: string;
  operationClass?: string;
  hazmatFlag?: string;
  outOfService?: string;
  fmcsaEin?: string;
  officerName?: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  bipdInsuranceOnFile?: string;
  bipdInsuranceRequired?: string;
  bipdRequiredAmount?: string;
  cargoInsuranceOnFile?: string;
  cargoInsuranceRequired?: string;
  bondInsuranceOnFile?: string;
  bondInsuranceRequired?: string;
  cargoCarried?: string[];
  source?: string;
}

interface Step1Props {
  onNext: (data: CarrierData | null) => void;
}

const GREEN = "#16A34A";

export default function Step1({ onNext }: Step1Props) {
  const [mode, setMode] = useState<"MC" | "DOT">("MC");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CarrierData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const lookup = async () => {
    if (value.length < 3) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    setError("");

    try {
      const res = await fetch(
        `/api/fmcsa-lookup?mode=${mode}&value=${encodeURIComponent(value)}`
      );
      const data = await res.json();
      if (data.carrier) {
        setResult(data.carrier);
      } else {
        setNotFound(true);
      }
    } catch {
      setError("Lookup failed. Please try again or enter details manually.");
    } finally {
      setLoading(false);
    }
  };

  const confirm = () => {
    setConfirmed(true);
    setTimeout(() => onNext(result), 600);
  };

  return (
    <div className="step-wrapper">
      {/* Eyebrow pill */}
      <div className="eyebrow">Step 1 of 5</div>

      {/* Headline with red accent shadowing on key word */}
      <h1
        className="headline"
        style={{
          fontSize: "clamp(28px, 5vw, 40px)",
          marginBottom: 8,
          marginTop: 4,
        }}
      >
        Let&apos;s find your <span className="accent">company</span>
      </h1>
      <p
        style={{
          color: "#4B5563",
          marginBottom: 24,
          fontSize: 15,
          lineHeight: 1.6,
        }}
      >
        Enter your MC or DOT number and we&apos;ll pull your information
        directly from the FMCSA database.
      </p>

      {/* MC/DOT toggle + lookup card */}
      <Box className="accent-top" style={{ padding: 24, marginBottom: 18 }}>
        {/* MC / DOT segmented pill */}
        <div
          role="tablist"
          aria-label="Lookup type"
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            background: "#F3F4F6",
            border: "1px solid #E5E7EB",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {(["MC", "DOT"] as const).map((m) => {
            const sel = mode === m;
            return (
              <button
                key={m}
                role="tab"
                aria-selected={sel}
                onClick={() => {
                  setMode(m);
                  setValue("");
                  setResult(null);
                  setNotFound(false);
                }}
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  border: "none",
                  borderRadius: 999,
                  background: sel
                    ? "linear-gradient(180deg, #E1232A 0%, #B8141A 100%)"
                    : "transparent",
                  color: sel ? "#FFFFFF" : "#4B5563",
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all .2s ease",
                  boxShadow: sel
                    ? "0 4px 10px rgba(215,25,32,.30), inset 0 1px 0 rgba(255,255,255,.18)"
                    : "none",
                }}
              >
                {m} Number
              </button>
            );
          })}
        </div>

        {/* Combined input with prefix */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              border: "1px solid #D1D5DB",
              borderRadius: 12,
              overflow: "hidden",
              background: "#FFFFFF",
              transition: "border-color .15s ease, box-shadow .15s ease",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = RED;
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                "0 0 0 3px rgba(215,25,32,.12)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "#D1D5DB";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
          >
            <span
              style={{
                padding: "13px 16px",
                background: "#F9FAFB",
                fontFamily: "Oswald, system-ui, sans-serif",
                fontSize: 16,
                fontWeight: 600,
                color: DARK,
                borderRight: "1px solid #E5E7EB",
                whiteSpace: "nowrap",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                letterSpacing: ".05em",
              }}
            >
              {mode}#
            </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={mode === "MC" ? "123456" : "9876543"}
              inputMode="numeric"
              pattern="[0-9]*"
              onKeyDown={(e) =>
                e.key === "Enter" && value.length > 3 && lookup()
              }
              style={{
                flex: 1,
                minWidth: 0,
                padding: "13px 16px",
                border: "none",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 16,
                background: "transparent",
                outline: "none",
                width: "100%",
                color: DARK,
              }}
            />
          </div>

          <Btn
            onClick={lookup}
            disabled={value.length < 3 || loading}
            style={{ width: "100%" }}
          >
            {loading ? "Checking FMCSA database…" : "Look Up →"}
          </Btn>
        </div>

        {/* Loading shimmer */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "18px 0 4px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 14,
              color: "#6B7280",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: RED,
                marginRight: 8,
                animation: "lightPulse 1.2s ease-in-out infinite",
              }}
            />
            Checking carrier databases…
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              background:
                "linear-gradient(180deg, rgba(254,226,226,.55) 0%, rgba(254,202,202,.45) 100%)",
              border: "1px solid rgba(215,25,32,.28)",
              borderRadius: 12,
              boxShadow: "0 1px 2px rgba(215,25,32,.06)",
            }}
          >
            <div
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                color: RED,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          </div>
        )}

        {/* Not found state */}
        {notFound && (
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              background:
                "linear-gradient(180deg, rgba(254,226,226,.55) 0%, rgba(254,202,202,.45) 100%)",
              border: "1px solid rgba(215,25,32,.28)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontFamily: "Oswald, system-ui, sans-serif",
                fontSize: 16,
                color: RED,
                fontWeight: 600,
                letterSpacing: ".02em",
              }}
            >
              No results found
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#4B5563",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Double-check your number or enter your info manually below.
            </div>
          </div>
        )}
      </Box>

      {/* ====================  RESULT CARD  ==================== */}
      {result && !confirmed && (
        <Box
          className="fade-in"
          style={{
            padding: 24,
            border: `1px solid ${GREEN}`,
            boxShadow:
              "0 8px 24px rgba(22,163,74,.18), 0 2px 6px rgba(22,163,74,.10), inset 0 1px 0 rgba(255,255,255,.65)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: `linear-gradient(180deg, #16A34A 0%, ${GREEN} 100%)`,
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(22,163,74,.30)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8.2L6.5 11.5L13 5"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div
              style={{
                fontFamily: "Oswald, system-ui, sans-serif",
                fontSize: 16,
                color: GREEN,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Carrier Found
              {result.source && (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 11,
                    fontWeight: 400,
                    color: "#9CA3AF",
                    textTransform: "none",
                    letterSpacing: 0,
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  via {result.source === "carrier411" ? "Carrier411" : "FMCSA"}
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px 20px",
              marginBottom: 20,
              padding: "14px 16px",
              background: "#FAFBFC",
              border: "1px solid #F3F4F6",
              borderRadius: 12,
            }}
            className="result-grid"
          >
            {[
              ["Company Name", result.name],
              [
                "Address",
                `${result.address}, ${result.city}, ${result.state} ${result.zip}`,
              ],
              ["DOT #", result.dot],
              ["MC #", result.mc || "DOT-only carrier (no MC#)"],
              ["Phone", result.phone],
              ["Email", result.email],
              ["Type", result.type],
              [
                "Status",
                <span
                  key="status"
                  style={{
                    color: result.status === "Active" ? GREEN : RED,
                    fontWeight: 700,
                  }}
                >
                  {result.status}
                </span>,
              ],
              ...(result.safetyRating ? [["Safety Rating", result.safetyRating]] : []),
              ...(result.totalPowerUnits ? [["Power Units", result.totalPowerUnits]] : []),
              ...(result.totalDrivers ? [["Total Drivers", result.totalDrivers]] : []),
              ...(result.insuranceOnFile
                ? [
                    [
                      "Insurance on File",
                      <span
                        key="ins"
                        style={{
                          color:
                            result.insuranceOnFile?.toLowerCase() === "yes"
                              ? GREEN
                              : RED,
                          fontWeight: 700,
                        }}
                      >
                        {result.insuranceOnFile}
                      </span>,
                    ],
                  ]
                : []),
            ].map(([k, v]) => (
              <div key={k as string}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: ".07em",
                    color: "#9CA3AF",
                    marginBottom: 2,
                  }}
                >
                  {k}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: DARK,
                    lineHeight: 1.4,
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Btn onClick={confirm}>Yes, that&apos;s us! Continue →</Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                setResult(null);
                setValue("");
              }}
            >
              Not us
            </Btn>
          </div>

          <style jsx>{`
            @media (max-width: 480px) {
              :global(.result-grid) {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
        </Box>
      )}

      {/* Confirmed splash */}
      {confirmed && (
        <div
          className="fade-in"
          style={{
            textAlign: "center",
            padding: 30,
            fontFamily: "Oswald, system-ui, sans-serif",
            fontSize: 22,
            color: GREEN,
            fontWeight: 600,
            letterSpacing: ".02em",
          }}
        >
          ✓ Confirmed! Loading your profile…
        </div>
      )}

      {/* Skip lookup link */}
      <div style={{ marginTop: 22, textAlign: "center" }}>
        <button
          onClick={() => onNext(null)}
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            color: "#6B7280",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            padding: "6px 10px",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#0B0B0C";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#6B7280";
          }}
        >
          Skip lookup — enter details manually →
        </button>
      </div>
    </div>
  );
}
