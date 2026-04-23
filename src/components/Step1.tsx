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
      <div
        style={{
          fontFamily: "DM Sans",
          fontSize: 13,
          fontWeight: 700,
          color: RED,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          marginBottom: 6,
        }}
      >
        Step 1 of 5
      </div>
      <h2
        style={{
          fontFamily: "DM Sans",
          fontSize: 34,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Let&apos;s find your company
      </h2>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 15 }}>
        Enter your MC or DOT number and we&apos;ll pull your information
        directly from the FMCSA database.
      </p>

      <Box style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["MC", "DOT"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setValue("");
                setResult(null);
                setNotFound(false);
              }}
              style={{
                flex: 1,
                padding: "10px",
                border: "2px solid " + (mode === m ? RED : "#ccc"),
                background: mode === m ? RED : "white",
                color: mode === m ? "white" : "#666",
                fontFamily: "DM Sans",
                fontSize: 18,
                fontWeight: 700,
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              {m} Number
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "2px solid " + DARK,
              borderRadius: 2,
              overflow: "hidden",
              background: "#fafaf8",
            }}
          >
            <span
              style={{
                padding: "12px 14px",
                background: "#f0eeea",
                fontFamily: "DM Sans",
                fontSize: 16,
                fontWeight: 700,
                borderRight: "2px solid " + DARK,
                whiteSpace: "nowrap",
                flexShrink: 0,
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
                padding: "12px 14px",
                border: "none",
                fontFamily: "DM Sans",
                fontSize: 16,
                background: "transparent",
                outline: "none",
                width: "100%",
              }}
            />
          </div>
          <Btn onClick={lookup} disabled={value.length < 3 || loading} style={{ width: "100%", textAlign: "center" }}>
            {loading ? "Checking FMCSA database..." : "Look Up →"}
          </Btn>
        </div>

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              fontFamily: "DM Sans",
              fontSize: 18,
              color: "#888",
            }}
          >
            Checking carrier databases...
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "#fff5f5",
              border: "2px solid #ffaaaa",
              borderRadius: 2,
            }}
          >
            <div
              style={{ fontFamily: "DM Sans", fontSize: 15, color: RED }}
            >
              {error}
            </div>
          </div>
        )}

        {notFound && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "#fff5f5",
              border: "2px solid #ffaaaa",
              borderRadius: 2,
            }}
          >
            <div
              style={{
                fontFamily: "DM Sans",
                fontSize: 17,
                color: RED,
                fontWeight: 700,
              }}
            >
              No results found
            </div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
              Double-check your number or enter your info manually below.
            </div>
          </div>
        )}
      </Box>

      {result && !confirmed && (
        <Box
          style={{
            padding: 20,
            borderColor: "#22a355",
            boxShadow: "3px 3px 0 #22a355",
          }}
          className="fade-in"
        >
          <div
            style={{
              fontFamily: "DM Sans",
              fontSize: 14,
              color: "#22a355",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".08em",
              marginBottom: 10,
            }}
          >
            ✓ Carrier Found
            {result.source && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: "#888", textTransform: "none", letterSpacing: 0 }}>
                via {result.source === "carrier411" ? "Carrier411" : "FMCSA"}
              </span>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 20px",
              marginBottom: 16,
            }}
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
                  style={{ color: result.status === "Active" ? "#22a355" : RED, fontWeight: 700 }}
                >
                  {result.status}
                </span>,
              ],
              ...(result.safetyRating ? [["Safety Rating", result.safetyRating]] : []),
              ...(result.totalPowerUnits ? [["Power Units", result.totalPowerUnits]] : []),
              ...(result.totalDrivers ? [["Total Drivers", result.totalDrivers]] : []),
              ...(result.insuranceOnFile ? [[
                "Insurance on File",
                <span
                  key="ins"
                  style={{ color: result.insuranceOnFile?.toLowerCase() === "yes" ? "#22a355" : RED, fontWeight: 700 }}
                >
                  {result.insuranceOnFile}
                </span>,
              ]] : []),
            ].map(([k, v]) => (
              <div key={k as string}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    color: "#888",
                  }}
                >
                  {k}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 1 }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
        </Box>
      )}

      {confirmed && (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            fontFamily: "DM Sans",
            fontSize: 22,
            color: "#22a355",
          }}
        >
          ✓ Confirmed! Loading your profile...
        </div>
      )}

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          onClick={() => onNext(null)}
          style={{
            fontFamily: "DM Sans",
            fontSize: 15,
            color: "#888",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Skip lookup — enter details manually →
        </button>
      </div>
    </div>
  );
}
