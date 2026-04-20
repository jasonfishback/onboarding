"use client";

import { useState } from "react";
import { DARK } from "@/components/ui";
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

  const goTo = (n: number) => { setStep(n); window.scrollTo(0, 0); };

  const handleSubmit = async (sig: Record<string, unknown>) => {
    setSigData(sig);
    setSubmitting(true);
    goTo(5);
    try {
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fmcsaData, companyData, docsData, wcData, sigData: sig, sessionId: (docsData as Record<string,unknown>)?.sessionId }),
      });
    } catch {
      setSubmitError("We had trouble sending your confirmation email, but your application was received. Please contact dispatch@simonexpress.com.");
    } finally {
      setSubmitting(false);
    }
  };

  const companyName = ((companyData?.legalName as string) || fmcsaData?.name || "");

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3ef" }}>
      <div style={{ background: DARK, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ borderLeft: "1.5px solid #444", paddingLeft: 16 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 22, color: "white", fontWeight: 700 }}>Simon Express</div>
          <div style={{ fontSize: 13, color: "#aaa" }}>Carrier Onboarding — Salt Lake City, Utah</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "DM Sans", fontSize: 14, color: "#888" }}>
          Need help? <a href="tel:8012607010" style={{ color: "#aaa" }}>801-260-7010</a>
        </div>
      </div>

      {step < 5 && <ProgressBar current={step} />}

      {step === 0 && <Step1 onNext={(data) => { if (data) setFmcsaData(data); goTo(1); }} />}
      {step === 1 && <Step2 prefill={fmcsaData} onNext={(data) => { setCompanyData(data); goTo(2); }} onBack={() => goTo(0)} />}
      {step === 2 && <Step3 onNext={(data) => { setDocsData(data); goTo(3); }} onBack={() => goTo(1)} companyName={companyName} />}
      {step === 3 && <Step4 onNext={(data) => { setWcData(data); goTo(4); }} onBack={() => goTo(2)} carrier={(companyData ?? fmcsaData) as Record<string, string> | null} />}
      {step === 4 && <Step5 onNext={handleSubmit} onBack={() => goTo(3)} companyName={companyName} />}
      {step === 5 && <Step6 companyName={companyName} companyData={companyData} docsData={docsData} wcData={wcData} sigData={sigData} submitting={submitting} error={submitError} />}
    </div>
  );
}
