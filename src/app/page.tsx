"use client";

import { useState, useEffect } from "react";
import { trackStep, clearSession } from "@/lib/kpiTracker";
import ProgressBar from "@/components/ProgressBar";
import Step1, { type CarrierData } from "@/components/Step1";
import Step2 from "@/components/Step2";
import Step3 from "@/components/Step3";
import Step4 from "@/components/Step4";
import Step5 from "@/components/Step5";
import Step6 from "@/components/Step6";

export default function Home() {
  const [step, setStep] = useState(0);
  const [fmcsaData, setFmcsaData] = useState<CarrierData | null>(null);
  const [companyData, setCompanyData] = useState<Record<string, unknown> | null>(null);
  const [docsData, setDocsData] = useState<Record<string, unknown> | null>(null);
  const [wcData, setWcData] = useState<Record<string, unknown> | null>(null);
  const [sigData, setSigData] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    trackStep({ step: 1 });
  }, []);

  const goTo = (n: number) => {
    setStep(n);
    window.scrollTo(0, 0);
    // Fire-and-forget tracker ping. Step is 1-indexed in KPI (1..6).
    trackStep({
      step: n + 1,
      // Flatten all known data into the ping so KPI can store partial state
      ...(fmcsaData || {}),
      ...(companyData || {}),
      ...(docsData || {}),
      ...(wcData || {}),
    });
  };

  const handleSubmit = async (sig: Record<string, unknown>) => {
    setSigData(sig);
    setSubmitting(true);
    goTo(5);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fmcsaData, companyData, docsData, wcData, sigData: sig, sessionId: (docsData as Record<string,unknown>)?.sessionId }),
      });
      // fetch() resolves on 4xx/5xx — must check res.ok explicitly.
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error("[client] /api/submit returned", res.status, errorText);
        setSubmitError("We had trouble processing your submission. Please contact dispatch@simonexpress.com so we can verify everything came through.");
        return;
      }
      const data = await res.json().catch(() => ({} as { dispatchSent?: boolean; carrierSent?: boolean }));
      // Even on 200, the server may have failed to dispatch the internal email
      if (data && data.dispatchSent === false) {
        console.warn("[client] submit succeeded but dispatch email failed");
      }
      // Mark KPI session as completed and clear so next visit is a new session
      trackStep({
        step: 6,
        completed: true,
        ...(fmcsaData || {}),
        ...(companyData || {}),
        ...(docsData || {}),
        ...(wcData || {}),
        ...(sig || {}),
      });
      clearSession();
    } catch (err) {
      console.error("[client] submit network error:", err);
      setSubmitError("We had trouble sending your confirmation email, but your application was received. Please contact dispatch@simonexpress.com.");
    } finally {
      setSubmitting(false);
    }
  };

  const companyName = ((companyData?.legalName as string) || fmcsaData?.name || "");

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* ============================================================
          MINIMAL HEADER — logo + mark + help phone (no nav).
          Frosted glass treatment matches the marketing site.
          ============================================================ */}
      <header
        style={{
          position: "relative",
          background: "rgba(255, 255, 255, 0.78)",
          backdropFilter: "saturate(180%) blur(14px)",
          WebkitBackdropFilter: "saturate(180%) blur(14px)",
          borderBottom: "1px solid rgba(229, 231, 235, .85)",
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <img
            src="/logo.jpg"
            alt="Simon Express"
            style={{ height: 38, objectFit: "contain", display: "block" }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.15,
              borderLeft: "1px solid #E5E7EB",
              paddingLeft: 14,
            }}
          >
            <span
              style={{
                fontFamily: "Oswald, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                color: "#0B0B0C",
                letterSpacing: ".05em",
                textTransform: "uppercase",
              }}
            >
              Carrier Onboarding
            </span>
            <span
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 11,
                color: "#6B7280",
              }}
            >
              Salt Lake City, Utah
            </span>
          </div>

          <div
            style={{
              marginLeft: "auto",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 13,
              color: "#6B7280",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            className="help-line"
          >
            <span className="help-text">Need help?</span>
            <a
              href="tel:8012607010"
              style={{
                color: "#D71920",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              801-260-7010
            </a>
          </div>
        </div>

        <style jsx>{`
          @media (max-width: 480px) {
            .help-text { display: none; }
          }
        `}</style>
      </header>

      {step < 5 && <ProgressBar current={step} />}

      {step === 0 && <Step1 onNext={(data) => { if (data) setFmcsaData(data); goTo(1); }} />}
      {step === 1 && <Step2 prefill={fmcsaData} onNext={(data) => { setCompanyData(data); goTo(2); }} onBack={() => goTo(0)} />}
      {step === 2 && <Step3 onNext={(data) => { setDocsData(data); goTo(3); }} onBack={() => goTo(1)} companyName={companyName} carrierEmail={(companyData?.email as string) || ""} companyData={companyData ?? undefined} />}
      {step === 3 && <Step4 onNext={(data) => { setWcData(data); goTo(4); }} onBack={() => goTo(2)} carrier={(companyData ?? fmcsaData) as Record<string, string> | null} />}
      {step === 4 && <Step5 onNext={handleSubmit} onBack={() => goTo(3)} companyName={companyName} companyData={companyData} />}
      {step === 5 && <Step6 companyName={companyName} companyData={companyData} fmcsaData={fmcsaData} docsData={docsData} wcData={wcData} sigData={sigData} submitting={submitting} error={submitError} />}
    </div>
  );
}
