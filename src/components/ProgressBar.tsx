"use client";

import { RED, DARK } from "./ui";

const STEPS = [
  "Carrier Lookup",
  "Company Profile",
  "Documents",
  "Workers Comp",
  "Agreement",
  "Complete",
];

export default function ProgressBar({ current }: { current: number }) {
  return (
    <div
      style={{
        padding: "16px 24px 0",
        background: "white",
        borderBottom: "2px solid " + DARK,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div
              key={i}
              style={{ flex: 1, position: "relative", textAlign: "center" }}
            >
              {i > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 0,
                    width: "50%",
                    height: 2,
                    background: done || active ? RED : "#ddd",
                    zIndex: 0,
                  }}
                />
              )}
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: "50%",
                    width: "50%",
                    height: 2,
                    background: done ? RED : "#ddd",
                    zIndex: 0,
                  }}
                />
              )}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  margin: "0 auto 6px",
                  background: done ? RED : active ? RED : "white",
                  border:
                    "2px solid " + (done || active ? RED : "#ccc"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 700,
                  color: done || active ? "white" : "#aaa",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: done || active ? 700 : 400,
                  color: active ? DARK : done ? "#555" : "#aaa",
                  lineHeight: 1.2,
                  paddingBottom: 10,
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
