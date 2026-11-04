import React, { useEffect, useRef, useState } from "react";
import { FaLayerGroup, FaUsers, FaGlobeAmericas, FaBriefcase } from "react-icons/fa";
import "./metrics.css";

export const DEFAULT_METRICS = [
  { value: 12, label: "Projects", Icon: FaLayerGroup },
  { value: 6, label: "Clients", Icon: FaUsers },
  { value: 3, label: "Experience", Icon: FaBriefcase }, 
  { value: 3, label: "Countries", Icon: FaGlobeAmericas },
];

const COUNT_MS = 1500;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Counts every metric from 0 to its value once, the first time the panel is in view.
function useCountUp(targets, startAfter) {
  const ref = useRef(null);
  const [counts, setCounts] = useState(() => targets.map(() => 0));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      setCounts(targets);
      return undefined;
    }

    let frame;
    let timer;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // Never start before `startAfter` ms since page load (lets the hero finish first).
        timer = setTimeout(() => {
          setVisible(true);
          let start;
          const tick = (now) => {
            if (start === undefined) start = now;
            const t = Math.min((now - start) / COUNT_MS, 1);
            setCounts(targets.map((v) => Math.round(v * easeOutCubic(t))));
            if (t < 1) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        }, Math.max(0, startAfter - performance.now()));
      },
      { threshold: 0.4 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    // Targets are static config; the count must only run once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, counts, visible };
}

// `entrance`: fade/slide in by itself when shown. Pass false when the parent
// animates the panel (the hero does, so it rises together with the portrait).
function Metrics({ items = DEFAULT_METRICS, startAfter = 0, entrance = true, className = "" }) {
  const { ref, counts, visible } = useCountUp(
    items.map((item) => item.value),
    startAfter
  );

  return (
    <div
      ref={ref}
      className={`mx-panel${entrance ? " mx-panel--enter" : ""}${visible ? " is-visible" : ""} ${className}`}
    >
      <ul className="mx-list" aria-label="Career highlights">
        {items.map(({ value, label /*, Icon */ }, i) => (
          <li key={label} className="mx-item">
            {/* Icons hidden for now. To show them again, restore `Icon` above and uncomment:
            <span className="mx-icon" aria-hidden="true">
              <Icon />
            </span>
            */}
            <span className="mx-text">
              <span className="mx-value" aria-hidden="true">
                {counts[i]}+
              </span>
              <span className="mx-label" aria-hidden="true">
                {label}
              </span>
              <span className="sr-only">{`${value}+ ${label}`}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Metrics;
