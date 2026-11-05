import React, { useEffect, useState } from "react";
import "./hero.css";
import headline from "../assets/portfolio/Icy Blue UI_UX Designer Logo.webp";
import phones from "../assets/portfolio/Neon Blue Smartphone UI Mockups.webp";
import desktop from "../assets/portfolio/Neon Blue Dark-Mode Dashboard Mockup.webp";
import portrait from "../assets/portfolio/Confident Indian Man Cutout with Gold Chain.webp";
import orbitLine from "../assets/portfolio/orbit-line.svg";
import Metrics from "./metrics";

// Length of the entrance timeline in hero.css (last annotation ends ~2.95s).
const ENTRANCE_MS = 3200;
const REDUCED_MOTION_MS = 500;
// The metrics panel rises with the portrait (same delay as .ph-portrait in hero.css),
// and its counters start at that moment.
const METRICS_START_MS = 1650;

const NOTES = [
  {
    key: "left-top",
    items: ["IDEA", "RESEARCH", "WIREFRAME", "UI DESIGN", "PROTOTYPE", "ITERATE", "BETTER", "EXPERIENCES"],
    ruleFirst: false,
  },
  { key: "right-top", items: ["PEOPLE", "IDEAS", "INTERFACES", "IMPACT"], ruleFirst: false },
  { key: "left-bottom", items: ["DESIGN", "SIMPLE", "SOLVE REAL", "PROBLEMS"], ruleFirst: true },
  { key: "right-bottom", items: ["PLAN", "DESIGN", "TEST", "ITERATE", "LAUNCH"], ruleFirst: true },
];

// Plays the entrance once per page load. State only moves "run" -> "done",
// so re-renders, resizes and scrolling never replay it; a refresh plays it again.
function useEntrance() {
  const [state, setState] = useState("run");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setState("done"), reduceMotion ? REDUCED_MOTION_MS : ENTRANCE_MS);
    return () => clearTimeout(timer);
  }, []);

  return state;
}

function Hero() {
  const entrance = useEntrance();

  return (
    <section className="ph" id="hero" data-anim={entrance} aria-label="Introduction">
      <div className="ph-visual">
        <div className="ph-light" aria-hidden="true" />

        <h2 className="ph-headline">
          <img className="ph-headline__img" src={headline} alt="UI/UX Designer" width="1672" height="941" fetchPriority="high" decoding="async" />
        </h2>

        <img className="ph-orbit" src={orbitLine} alt="" aria-hidden="true" width="440" height="160" />
        <img className="ph-phones" src={phones} alt="" aria-hidden="true" width="1442" height="1091" fetchPriority="high" decoding="async" />
        <img className="ph-desktop" src={desktop} alt="" aria-hidden="true" width="1619" height="971" fetchPriority="high" decoding="async" />
        <img className="ph-portrait" src={portrait} alt="Portrait of Jayakumar" width="1263" height="1245" fetchPriority="high" decoding="async" />

        {NOTES.map(({ key, items, ruleFirst }) => (
          <div key={key} className={`ph-note ph-note--${key}`}>
            {/* {ruleFirst && <span className="ph-note__rule" aria-hidden="true" />} */}
            <ul className="ph-note__list">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {/* {!ruleFirst && <span className="ph-note__rule" aria-hidden="true" />} */}
          </div>
        ))}

        <p className="ph-script">
          <span className="ph-script__line">Design</span>
          <span className="ph-script__line ph-script__line--2">for</span>
          <span className="ph-script__line ph-script__line--3">Real People</span>
        </p>
      </div>

      <Metrics className="ph-metrics" startAfter={METRICS_START_MS} entrance={false} />
    </section>
  );
}

export default Hero;
