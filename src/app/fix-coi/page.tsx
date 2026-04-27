"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface FixCoiContext {
  agentEmail: string;
  companyName: string;
  carrierEmail: string;
}

function FixCoiInner() {
  const searchParams = useSearchParams();
  const [agentEmail, setAgentEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [carrierEmail, setCarrierEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Decode the URL-encoded context (base64-encoded JSON in ?d=)
  useEffect(() => {
    const d = searchParams.get("d");
    if (!d) {
      setLoaded(true);
      return;
    }
    try {
      const json = JSON.parse(atob(decodeURIComponent(d))) as FixCoiContext;
      // Pre-fill with the (likely-bad) email so user can correct it in place
      setAgentEmail(json.agentEmail || "");
      setCompanyName(json.companyName || "");
      setCarrierEmail(json.carrierEmail || "");
    } catch {
      // Bad/invalid context — start blank
    }
    setLoaded(true);
  }, [searchParams]);

  // Quick client-side format check for the agent email
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agentEmail.trim());

  const handleSend = async () => {
    if (!emailValid) {
      setErrorMsg("Please enter a valid email address");
      setResult("error");
      return;
    }
    setSending(true);
    setResult("idle");
    setErrorMsg("");
    try {
      const res = await fetch("/api/send-agent-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentEmail: agentEmail.trim(),
          companyName,
          carrierEmail,
        }),
      });
      if (res.ok) {
        setResult("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.error || "Failed to send. Please try again.");
        setResult("error");
      }
    } catch (e) {
      setErrorMsg(String(e));
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "DM Sans, system-ui, sans-serif" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f4f5",
      fontFamily: "DM Sans, system-ui, sans-serif",
      padding: "40px 16px",
      color: "#18181b",
    }}>
      <div style={{
        maxWidth: 540,
        margin: "0 auto",
        background: "white",
        borderRadius: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,.06)",
        overflow: "hidden",
      }}>
        <div style={{ background: "#1a1a1a", padding: "24px 28px", color: "white" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>
            Simon Express Logistics
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-.3px" }}>
            Resend Certificate Request
          </h1>
        </div>

        <div style={{ padding: "26px 28px" }}>
          {result === "success" ? (
            <div style={{ background: "#edfaf3", border: "1px solid #22a355", borderRadius: 8, padding: "20px 22px" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#166534", marginBottom: 6 }}>
                ✓ Request Sent
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#15803d", lineHeight: 1.5 }}>
                A new certificate request was sent to <strong>{agentEmail}</strong>.
                {carrierEmail && <> The carrier <strong>{carrierEmail}</strong> was CC&apos;d.</>}
                <br />
                <span style={{ fontSize: 13, color: "#16a34a" }}>You can close this tab.</span>
              </p>
            </div>
          ) : (
            <>
              <p style={{ margin: "0 0 20px", fontSize: 14, color: "#52525b", lineHeight: 1.55 }}>
                The original COI agent email looked invalid. Update the address below and resend the certificate request.
              </p>

              <label style={{ display: "block", marginBottom: 18 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  Carrier Name
                </span>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    border: "1.5px solid #d4d4d8",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="Carrier Name LLC"
                />
              </label>

              <label style={{ display: "block", marginBottom: 18 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  Insurance Agent Email <span style={{ color: "#CC1B1B" }}>*</span>
                </span>
                <input
                  type="email"
                  value={agentEmail}
                  onChange={e => setAgentEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    border: `1.5px solid ${agentEmail && !emailValid ? "#CC1B1B" : "#d4d4d8"}`,
                    borderRadius: 6,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    background: agentEmail && !emailValid ? "#fff5f5" : "white",
                  }}
                  placeholder="agent@insurancecompany.com"
                  autoFocus
                />
                {agentEmail && !emailValid && (
                  <div style={{ fontSize: 12, color: "#CC1B1B", marginTop: 4 }}>⚠ Invalid email format</div>
                )}
              </label>

              <label style={{ display: "block", marginBottom: 24 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  Carrier Email (CC&apos;d on request)
                </span>
                <input
                  type="email"
                  value={carrierEmail}
                  onChange={e => setCarrierEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    border: "1.5px solid #d4d4d8",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="dispatch@carriername.com"
                />
              </label>

              {result === "error" && (
                <div style={{ background: "#fff5f5", border: "1px solid #CC1B1B", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
                  ⚠ {errorMsg}
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={sending || !emailValid}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  background: sending || !emailValid ? "#a1a1aa" : "#CC1B1B",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: sending || !emailValid ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {sending ? "Sending…" : "Send Certificate Request"}
              </button>

              <div style={{ marginTop: 14, fontSize: 11, color: "#a1a1aa", textAlign: "center" }}>
                The agent will receive the same standard request used during onboarding,
                with setup@simonexpress.com CC&apos;d.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FixCoiPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}>
      <FixCoiInner />
    </Suspense>
  );
}
