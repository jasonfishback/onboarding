"use client";

import { useState } from "react";
import { Box, Btn, RED, DARK } from "@/components/ui";

interface Step6Props {
  companyName: string;
  companyData: Record<string, unknown> | null;
  docsData: Record<string, unknown> | null;
  wcData: Record<string, unknown> | null;
  sigData: Record<string, unknown> | null;
  submitting?: boolean;
  submitted?: boolean;
  error?: string;
}

export default function Step6({
  companyName,
  submitting,
  submitted,
  error,
}: Step6Props) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
      {submitting ? (
        <>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontFamily: "DM Sans", fontSize: 34, fontWeight: 700, marginBottom: 10 }}>
            Submitting your application...
          </h2>
          <p style={{ fontSize: 15, color: "#666" }}>
            Please wait while we send your onboarding packet.
          </p>
        </>
      ) : error ? (
        <>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontFamily: "DM Sans", fontSize: 34, fontWeight: 700, marginBottom: 10 }}>
            Submission issue
          </h2>
          <p style={{ fontSize: 15, color: "#666", marginBottom: 20 }}>
            {error}
          </p>
          <p style={{ fontSize: 14, color: "#888" }}>
            Please email <a href="mailto:dispatch@simonexpress.com" style={{ color: RED }}>dispatch@simonexpress.com</a> or call{" "}
            <a href="tel:8012607010" style={{ color: RED }}>801-260-7010</a>.
          </p>
        </>
      ) : (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: "DM Sans", fontSize: 40, fontWeight: 700, marginBottom: 10 }}>
            You&apos;re all set!
          </h2>
          <p style={{ fontSize: 16, color: "#555", marginBottom: 28, lineHeight: 1.7 }}>
            Thank you, <strong>{companyName || "Carrier"}</strong>. Your onboarding application has been submitted to Simon Express.
            <br />
            A confirmation has been sent to your email address.
          </p>

          <Box style={{ padding: 24, marginBottom: 28, textAlign: "left" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
              What happens next?
            </div>
            {[
              ["📋", "Application Review", "Our team will review your documents as soon as possible."],
              ["📧", "Email Confirmation", "You'll receive a confirmation email with your packet copy."],
              ["📞", "Questions?", "Call us at 801-260-7010 or email dispatch@simonexpress.com"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#777" }}>{desc}</div>
                </div>
              </div>
            ))}
          </Box>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="tel:8012607010" style={{ textDecoration: "none" }}>
              <Btn style={{ fontSize: 16, padding: "12px 24px" }}>📞 Call Us Now</Btn>
            </a>
            <a href="mailto:dispatch@simonexpress.com" style={{ textDecoration: "none" }}>
              <Btn variant="secondary" style={{ fontSize: 16, padding: "12px 24px" }}>📧 Email Us</Btn>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
