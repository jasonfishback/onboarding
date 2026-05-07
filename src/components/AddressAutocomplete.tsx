"use client";

import { useState, useEffect, useRef } from "react";

interface AddressAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (parts: { street: string; city: string; state: string; zip: string }) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
}

interface Prediction {
  placeId: string;
  description: string;
}

const RED = "#D71920";

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  error,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showList, setShowList] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks whether the current `value` was just placed there by a selection
  // (vs. typed by the user). True = don't fetch and don't reopen on focus.
  const justSelectedRef = useRef(false);

  // Debounced suggestion lookup
  useEffect(() => {
    // If the value was set by a prediction click, skip this fetch.
    if (justSelectedRef.current) {
      // Don't reset the flag here — only typing should reset it (see onChange).
      return;
    }
    if (!value || value.length < 3) {
      setPredictions([]);
      setShowList(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/places?mode=suggest&q=${encodeURIComponent(value)}`
        );
        if (res.ok) {
          const data = await res.json();
          const list = data.predictions || [];
          setPredictions(list);
          setShowList(list.length > 0);
          setHighlightIdx(-1);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowList(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleUserType = (v: string) => {
    // User is typing — they want to search again
    justSelectedRef.current = false;
    onChange(v);
  };

  const handleSelect = async (p: Prediction) => {
    // Lock down the dropdown immediately and prevent re-opens
    justSelectedRef.current = true;
    setShowList(false);
    setPredictions([]);
    setHighlightIdx(-1);

    onChange(p.description);

    // Blur the input so onFocus can't fire and re-trigger anything
    inputRef.current?.blur();

    try {
      const res = await fetch(
        `/api/places?mode=details&placeId=${encodeURIComponent(p.placeId)}`
      );
      if (res.ok) {
        const data = await res.json();
        onSelect({
          street: data.street || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
        });
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(predictions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowList(false);
    }
  };

  const handleFocus = () => {
    setFocused(true);
    // Only reopen the list if user is actively searching (not after a select)
    if (!justSelectedRef.current && predictions.length > 0) {
      setShowList(true);
    }
  };

  const handleBlur = () => {
    setFocused(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <label className="field-label" style={{ marginBottom: 6 }}>
        Street Address{" "}
        {required && <span style={{ color: RED }}>*</span>}
      </label>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleUserType(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || "Start typing address…"}
        autoComplete="off"
        style={{
          width: "100%",
          padding: "11px 14px",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
          color: "#0B0B0C",
          background: error ? "#FFF5F5" : "#FFFFFF",
          border: `1px solid ${error ? RED : focused ? RED : "#D1D5DB"}`,
          borderRadius: 10,
          outline: "none",
          boxSizing: "border-box",
          boxShadow: focused ? "0 0 0 3px rgba(215,25,32,.12)" : "none",
          transition: "border-color .15s ease, box-shadow .15s ease",
        }}
      />

      {loading && (
        <div
          style={{
            position: "absolute",
            right: 14,
            top: 38,
            fontSize: 11,
            color: "#9CA3AF",
          }}
          aria-hidden="true"
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: RED,
              animation: "lightPulse 1.2s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {showList && predictions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 50,
            boxShadow:
              "0 12px 28px rgba(11,11,12,.10), 0 6px 12px rgba(11,11,12,.06)",
          }}
        >
          {predictions.map((p, i) => (
            <div
              key={p.placeId}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(p);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
              style={{
                padding: "11px 14px",
                fontSize: 13,
                fontFamily: "Inter, system-ui, sans-serif",
                color: "#0B0B0C",
                cursor: "pointer",
                background:
                  highlightIdx === i ? "rgba(215,25,32,.06)" : "transparent",
                borderBottom:
                  i < predictions.length - 1 ? "1px solid #F3F4F6" : "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "background .12s ease",
              }}
            >
              <span
                style={{
                  color: highlightIdx === i ? RED : "#9CA3AF",
                  fontSize: 14,
                  flexShrink: 0,
                  transition: "color .12s ease",
                }}
              >
                📍
              </span>
              <span style={{ lineHeight: 1.4 }}>{p.description}</span>
            </div>
          ))}
          <div
            style={{
              padding: "6px 14px",
              fontSize: 10,
              color: "#9CA3AF",
              fontStyle: "italic",
              borderTop: "1px solid #F3F4F6",
              textAlign: "right",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
