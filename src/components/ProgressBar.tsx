"use client";

/**
 * Carrier Onboarding ProgressBar
 * ─ Frosted glass header with flashing red lights along the top
 * ─ Real visual stepper: filled circles for done, glowing red ring for active
 * ─ Connector lines fade from green (done) → grey (upcoming)
 * ─ Mobile responsive: labels hide under 480px, circles shrink under 380px
 */

import React from "react";

const STEPS = [
  "Carrier Lookup",
  "Company Profile",
  "Documents",
  "Workers Comp",
  "Agreement",
  "Complete",
];

const RED  = "#D71920";
const RED2 = "#B8141A";
const GREEN = "#16A34A";
const INK  = "#0B0B0C";
const MUTE = "#9CA3AF";
const LINE = "#E5E7EB";

export default function ProgressBar({ current }: { current: number }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(248, 249, 250, 0.78)",
        backdropFilter: "saturate(180%) blur(14px)",
        WebkitBackdropFilter: "saturate(180%) blur(14px)",
        borderBottom: "1px solid rgba(229, 231, 235, .85)",
        boxShadow: "0 1px 12px rgba(11,11,12,.04)",
      }}
    >
      {/* ============================================================
          FLASHING LIGHT BAR — runs along top edge of the stepper.
          A tiny moving spotlight + four pulsing dots that brighten
          based on how far through the wizard the user is.
          ============================================================ */}
      <div
        style={{
          position: "relative",
          height: 4,
          background: `linear-gradient(90deg, ${LINE} 0%, ${LINE} 100%)`,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        {/* Filled progress portion */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${Math.min(((current + 1) / STEPS.length) * 100, 100)}%`,
            background: `linear-gradient(90deg, ${GREEN} 0%, ${RED} 100%)`,
            transition: "width .6s cubic-bezier(.65,0,.35,1)",
            boxShadow: `0 0 12px ${RED}66`,
          }}
        />
        {/* Sweeping highlight — the "spotlight" */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: 90,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.85) 50%, transparent 100%)",
            animation: "lightSweep 3s ease-in-out infinite",
          }}
        />
      </div>

      {/* Pulsing dot row — sits just under the bar */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          gap: 12,
          padding: "6px 0 0",
        }}
        aria-hidden="true"
      >
        {Array.from({ length: 5 }).map((_, i) => {
          // Each dot's brightness scales with progress
          const lit = i <= current;
          return (
            <span
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: lit ? RED : "#D1D5DB",
                boxShadow: lit ? `0 0 8px ${RED}AA, 0 0 2px ${RED}` : "none",
                animation: lit
                  ? `lightPulse 1.4s ease-in-out ${i * 0.15}s infinite`
                  : "none",
              }}
            />
          );
        })}
      </div>

      {/* ============================================================
          STEPPER
          ============================================================ */}
      <div
        style={{
          padding: "12px 16px 14px",
          maxWidth: 880,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0,
            position: "relative",
          }}
        >
          {STEPS.map((label, i) => {
            const done   = i < current;
            const active = i === current;
            const upcoming = i > current;

            // Circle visuals
            const circleBg = done
              ? `linear-gradient(180deg, #16A34A 0%, ${GREEN} 100%)`
              : active
                ? `linear-gradient(180deg, #E1232A 0%, ${RED2} 100%)`
                : "#FFFFFF";
            const circleBorder = done
              ? GREEN
              : active
                ? RED
                : LINE;
            const circleColor = done || active ? "#FFFFFF" : MUTE;
            const circleShadow = done
              ? `0 4px 10px rgba(22,163,74,.30), inset 0 1px 0 rgba(255,255,255,.18)`
              : active
                ? `0 6px 16px rgba(215,25,32,.36), 0 2px 4px rgba(215,25,32,.24), inset 0 1px 0 rgba(255,255,255,.20)`
                : "none";

            // Connector line (left half + right half from the circle)
            const leftConnector = done
              ? GREEN
              : active
                ? `linear-gradient(90deg, ${GREEN}, ${RED})`
                : LINE;
            const rightConnector = done
              ? `linear-gradient(90deg, ${GREEN}, ${i + 1 === current ? RED : LINE})`
              : LINE;

            return (
              <div
                key={i}
                style={{ flex: 1, position: "relative", textAlign: "center" }}
              >
                {/* left connector (skip on first) */}
                {i > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 17,
                      left: 0,
                      width: "50%",
                      height: 3,
                      background: leftConnector,
                      borderRadius: 2,
                      zIndex: 0,
                      transition: "background .4s ease",
                    }}
                  />
                )}
                {/* right connector (skip on last) */}
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 17,
                      left: "50%",
                      width: "50%",
                      height: 3,
                      background: rightConnector,
                      borderRadius: 2,
                      zIndex: 0,
                      transition: "background .4s ease",
                    }}
                  />
                )}

                {/* circle */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    margin: "0 auto 8px",
                    background: circleBg,
                    border: `2px solid ${circleBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    zIndex: 1,
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: circleColor,
                    boxShadow: circleShadow,
                    transition: "all .3s ease",
                    animation: active ? "ringPulse 2s ease-in-out infinite" : "none",
                  }}
                >
                  {done ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 8.2L6.5 11.5L13 5"
                        stroke="white"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>

                {/* label */}
                <div
                  className="step-label"
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 11,
                    fontWeight: done || active ? 600 : 500,
                    color: active ? INK : done ? GREEN : MUTE,
                    lineHeight: 1.25,
                    letterSpacing: ".01em",
                    transition: "color .3s ease, font-weight .3s ease",
                  }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 480px) {
          /* Hide labels on very narrow screens — circles + numbers carry the info */
          :global(.step-label) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
