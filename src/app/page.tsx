"use client";

import { useState, useEffect, useRef } from "react";
import { trackStep, clearSession, getSessionId } from "@/lib/kpiTracker";
import ProgressBar from "@/components/ProgressBar";
import Step1, { type CarrierData } from "@/components/Step1";
import Step2 from "@/components/Step2";
import Step3 from "@/components/Step3";
import Step4 from "@/components/Step4";
import Step5 from "@/components/Step5";
import Step6 from "@/components/Step6";

// ── Saved progress ───────────────────────────────────────────────────────
// Everything the carrier has entered is mirrored into THIS browser's
// localStorage as they move through the steps, so a closed tab, a reload or a
// dead connection doesn't send them back to the start. It lives only on their
// device, expires on its own, and is wiped the moment a submit succeeds.
// (Uploaded documents are already held server-side under docsData.sessionId
// until the submit consumes them, so they come back with the session.)
const PROGRESS_KEY = "simon_setup_progress_v1";
const PROGRESS_TTL_MS = 48 * 60 * 60 * 1000;

type PendingSubmit = { body: string; sig: Record<string, unknown> };
type SavedProgress = {
  savedAt: number;
  step: number;
  fmcsaData: CarrierData | null;
  companyData: Record<string, unknown> | null;
  docsData: Record<string, unknown> | null;
  wcData: Record<string, unknown> | null;
  // Set once the carrier has signed and tapped Submit but it hasn't gone through.
  pending: PendingSubmit | null;
};

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    const fresh = saved && typeof saved.savedAt === "number" && Date.now() - saved.savedAt < PROGRESS_TTL_MS;
    if (!fresh || typeof saved.step !== "number" || saved.step < 1 || saved.step > 5) {
      localStorage.removeItem(PROGRESS_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

function saveProgress(progress: SavedProgress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* storage full/blocked — resume just won't be offered */ }
}

function clearProgress(): void {
  try { localStorage.removeItem(PROGRESS_KEY); } catch {}
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [fmcsaData, setFmcsaData] = useState<CarrierData | null>(null);
  const [companyData, setCompanyData] = useState<Record<string, unknown> | null>(null);
  const [docsData, setDocsData] = useState<Record<string, unknown> | null>(null);
  const [wcData, setWcData] = useState<Record<string, unknown> | null>(null);
  const [sigData, setSigData] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Saved progress found on load — offered on the first screen, never applied silently
  // (a dispatcher may be setting up a different carrier on the same device).
  const [resumeOffer, setResumeOffer] = useState<SavedProgress | null>(null);
  // Flips once the packet is delivered so nothing gets re-saved afterwards.
  const submitted = useRef(false);

  useEffect(() => {
    trackStep({ step: 1 });
    setResumeOffer(loadProgress());
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

  // The exact request body + signature for the submission in flight. Kept in a
  // ref so an automatic or manual retry re-sends the SAME packet with the SAME
  // submissionId (the server uses that id to make sure it only processes once).
  const pendingSubmit = useRef<PendingSubmit | null>(null);

  // Mirror progress to the device whenever the carrier lands on a new step.
  // Nothing is written on the first screen, so an unanswered resume offer is
  // never overwritten by an empty form.
  useEffect(() => {
    if (step < 1 || submitted.current) return;
    saveProgress({ savedAt: Date.now(), step, fmcsaData, companyData, docsData, wcData, pending: step === 5 ? pendingSubmit.current : null });
  }, [step, fmcsaData, companyData, docsData, wcData]);

  const resumeSaved = () => {
    const saved = resumeOffer;
    if (!saved) return;
    setFmcsaData(saved.fmcsaData);
    setCompanyData(saved.companyData);
    setDocsData(saved.docsData);
    setWcData(saved.wcData);
    setResumeOffer(null);
    if (saved.step === 5 && saved.pending) {
      // They had already signed and tapped Submit — put them straight back on
      // the submit screen with the same packet ready to send.
      pendingSubmit.current = saved.pending;
      setSigData(saved.pending.sig);
      setSubmitError("Welcome back. Your application is filled out and signed but has NOT been submitted yet. Tap Try Again to send it.");
      setStep(5);
    } else {
      // Step 5 without a packet can't be re-sent — fall back to the signing step.
      setStep(Math.min(saved.step, 4));
    }
    window.scrollTo(0, 0);
  };

  const startOver = () => {
    clearProgress();
    clearSession(); // a fresh start is a new funnel session in KPI
    setResumeOffer(null);
    trackStep({ step: 1 });
  };

  const NETWORK_ERROR =
    "Your application has NOT been submitted yet. We couldn't reach our server — usually this means your internet connection dropped. Everything you entered is saved on this device: check your connection and tap Try Again. If this page closes, reopen setup.simonexpress.com on this same device to pick up right here.";
  const SERVER_ERROR =
    "We had trouble processing your submission. Tap Try Again — if it keeps happening, contact dispatch@simonexpress.com so we can verify everything came through.";

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // Wait before a retry: a short backoff, and if the browser reports it is
  // offline, hold (up to 30s) until it comes back instead of burning attempts.
  const waitForNetwork = async (failures: number) => {
    await sleep([1500, 4000, 8000][failures - 1] ?? 8000);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await new Promise<void>((resolve) => {
        const done = () => { window.removeEventListener("online", done); clearTimeout(timer); resolve(); };
        const timer = setTimeout(done, 30000);
        window.addEventListener("online", done);
      });
      await sleep(1000);
    }
  };

  const sendSubmission = async () => {
    const pending = pendingSubmit.current;
    if (!pending) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const MAX_NETWORK_FAILURES = 4; // 1 try + 3 automatic retries
      const MAX_IN_PROGRESS_WAITS = 8; // ~40s for a first attempt still running
      let networkFailures = 0;
      let inProgressWaits = 0;
      for (;;) {
        let res: Response;
        try {
          res = await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: pending.body,
          });
        } catch (err) {
          // fetch() only rejects when the request never completed (connection
          // dropped, offline, phone switched networks). The packet may not have
          // reached us at all — retry rather than strand the carrier.
          networkFailures++;
          console.error(`[client] submit network error (attempt ${networkFailures}):`, err);
          if (networkFailures >= MAX_NETWORK_FAILURES) {
            setSubmitError(NETWORK_ERROR);
            return;
          }
          await waitForNetwork(networkFailures);
          continue;
        }
        // 202 = an earlier attempt reached the server and is still processing.
        if (res.status === 202) {
          inProgressWaits++;
          if (inProgressWaits > MAX_IN_PROGRESS_WAITS) {
            setSubmitError(SERVER_ERROR);
            return;
          }
          await sleep(5000);
          continue;
        }
        // fetch() resolves on 4xx/5xx — must check res.ok explicitly.
        if (!res.ok) {
          const errorText = await res.text().catch(() => "");
          console.error("[client] /api/submit returned", res.status, errorText);
          setSubmitError(SERVER_ERROR);
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
          ...(pending.sig || {}),
        });
        clearSession();
        // Delivered — wipe the saved copy from this device.
        submitted.current = true;
        clearProgress();
        pendingSubmit.current = null;
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (sig: Record<string, unknown>) => {
    setSigData(sig);
    let submissionId = "";
    try { submissionId = (crypto as Crypto).randomUUID(); } catch { submissionId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }
    pendingSubmit.current = {
      sig,
      body: JSON.stringify({ fmcsaData, companyData, docsData, wcData, sigData: sig, sessionId: (docsData as Record<string,unknown>)?.sessionId, kpiSessionId: getSessionId(), submissionId }),
    };
    goTo(5);
    await sendSubmission();
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

      {step === 0 && resumeOffer && (
        <div style={{ maxWidth: 560, margin: "24px auto 0", padding: "0 20px" }}>
          <div style={{ border: "2px solid #16A34A", borderRadius: 12, background: "#f0faf4", padding: 20, textAlign: "center" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Welcome back</div>
            <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 14px" }}>
              We saved your progress
              {((resumeOffer.companyData?.legalName as string) || resumeOffer.fmcsaData?.name) ? <> for <strong>{(resumeOffer.companyData?.legalName as string) || resumeOffer.fmcsaData?.name}</strong></> : null}
              {resumeOffer.pending ? " — it is signed and ready to submit." : ` — you were on step ${Math.min(resumeOffer.step, 4) + 1} of 6.`}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={resumeSaved} style={{ background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Continue where I left off →
              </button>
              <button onClick={startOver} style={{ background: "#fff", color: "#444", border: "1px solid #bbb", borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Start over
              </button>
            </div>
          </div>
        </div>
      )}
      {step === 0 && <Step1 onNext={(data) => { if (data) setFmcsaData(data); goTo(1); }} />}
      {step === 1 && <Step2 prefill={fmcsaData} onNext={(data) => { setCompanyData(data); goTo(2); }} onBack={() => goTo(0)} />}
      {step === 2 && <Step3 onNext={(data) => { setDocsData(data); goTo(3); }} onBack={() => goTo(1)} companyName={companyName} carrierEmail={(companyData?.email as string) || ""} companyData={companyData ?? undefined} />}
      {step === 3 && <Step4 onNext={(data) => { setWcData(data); goTo(4); }} onBack={() => goTo(2)} carrier={(companyData ?? fmcsaData) as Record<string, string> | null} />}
      {step === 4 && <Step5 onNext={handleSubmit} onBack={() => goTo(3)} companyName={companyName} companyData={companyData} />}
      {step === 5 && <Step6 companyName={companyName} companyData={companyData} fmcsaData={fmcsaData} docsData={docsData} wcData={wcData} sigData={sigData} submitting={submitting} error={submitError} onRetry={sendSubmission} />}
    </div>
  );
}
