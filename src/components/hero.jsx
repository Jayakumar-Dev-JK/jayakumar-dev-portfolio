import React, { useEffect, useState } from "react";
import "./hero.css";
import headline from "../assets/portfolio/Icy-Blue-UI_UX-Designer-Logo.webp";
import headline530 from "../assets/portfolio/Icy-Blue-UI_UX-Designer-Logo-530w.webp";
import headline1060 from "../assets/portfolio/Icy-Blue-UI_UX-Designer-Logo-1060w.webp";
import phones from "../assets/portfolio/Neon-Blue-Smartphone-UI-Mockups.webp";
import phones260 from "../assets/portfolio/Neon-Blue-Smartphone-UI-Mockups-260w.webp";
import phones520 from "../assets/portfolio/Neon-Blue-Smartphone-UI-Mockups-520w.webp";
import phones780 from "../assets/portfolio/Neon-Blue-Smartphone-UI-Mockups-780w.webp";
import desktop from "../assets/portfolio/Neon-Blue-Dark-Mode-Dashboard-Mockup.webp";
import desktop300 from "../assets/portfolio/Neon-Blue-Dark-Mode-Dashboard-Mockup-300w.webp";
import desktop600 from "../assets/portfolio/Neon-Blue-Dark-Mode-Dashboard-Mockup-600w.webp";
import desktop900 from "../assets/portfolio/Neon-Blue-Dark-Mode-Dashboard-Mockup-900w.webp";
import portrait from "../assets/portfolio/Confident-Indian-Man-Cutout-with-Gold-Chain.webp";
import portrait560 from "../assets/portfolio/Confident-Indian-Man-Cutout-with-Gold-Chain-560w.webp";
import portrait1120 from "../assets/portfolio/Confident-Indian-Man-Cutout-with-Gold-Chain-1120w.webp";
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
          <img className="ph-headline__img" src={headline} srcSet={`${headline530} 530w, ${headline1060} 1060w, ${headline} 1672w`} sizes="(min-width:1280px) 466px, (min-width:1024px) 351px, (min-width:768px) 521px, 68vw" alt="UI/UX Designer" width="1672" height="941" fetchpriority="high" decoding="async" />
        </h2>

        <img className="ph-orbit" src={orbitLine} alt="" aria-hidden="true" width="440" height="160" />
        <img className="ph-phones" src={phones} srcSet={`${phones260} 260w, ${phones520} 520w, ${phones780} 780w, ${phones} 1442w`} sizes="(min-width:1280px) 230px, (min-width:1024px) 173px, (min-width:768px) 257px, 33vw" alt="" aria-hidden="true" width="1442" height="1091" fetchpriority="high" decoding="async" />
        <img className="ph-desktop" src={desktop} srcSet={`${desktop300} 300w, ${desktop600} 600w, ${desktop900} 900w, ${desktop} 1619w`} sizes="(min-width:1280px) 264px, (min-width:1024px) 199px, (min-width:768px) 296px, 38vw" alt="" aria-hidden="true" width="1619" height="971" fetchpriority="high" decoding="async" />
        <img className="ph-portrait" src={portrait} srcSet={`${portrait560} 560w, ${portrait1120} 1120w, ${portrait} 1263w`} sizes="(min-width:1280px) 509px, (min-width:1024px) 383px, (min-width:768px) 569px, 74vw" alt="Portrait of Jayakumar" width="1263" height="1245" fetchpriority="high" decoding="async" />

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
