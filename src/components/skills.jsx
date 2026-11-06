import React, { useCallback, useEffect, useState } from "react";
import { SkillLogo, TechIcon } from "./techIcon";

// Tech Stack & Skills. Categories and skills come from Firestore (managed in /admin/tech-stack),
// already filtered to active items and sorted in admin order. Each logo has a white default
// version and an original hover version (files in Cloudinary, or the built-in logos).

const TechItem = ({ skill }) => (
  <li
    className="ti-host group flex min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-2 transition-colors duration-300 hover:bg-slate-800/40"
    title={skill.name}
  >
    <span className="flex h-9 items-center justify-center">
      <SkillLogo skill={skill} size={32} />
    </span>
    <span className="w-full break-words text-center text-xs leading-tight text-slate-300 transition-colors duration-300 group-hover:text-teal-200">
      {skill.name}
    </span>
  </li>
);

const CategoryBlock = ({ category, first }) => (
  <section
    aria-labelledby={`tech-${category.id}`}
    className={first ? "" : "mt-4 border-t border-slate-700/50 pt-4"}
  >
    <h2
      id={`tech-${category.id}`}
      className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300"
    >
      <TechIcon kind="category" icon={category.icon} name={category.name} size={18} className="text-slate-400" />
      {category.name}
    </h2>
    <ul className="grid grid-cols-3 gap-x-1 gap-y-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
      {category.skills.map((skill) => (
        <TechItem key={skill.id} skill={skill} />
      ))}
    </ul>
  </section>
);

const Skeleton = () => (
  <div role="status" aria-label="Loading tech stack" className="space-y-4 py-2">
    {[0, 1, 2].map((row) => (
      <div key={row}>
        <div className="mb-3 h-3 w-28 animate-pulse rounded bg-slate-700/50" />
        <div className="flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-12 animate-pulse rounded-lg bg-slate-700/40" />
          ))}
        </div>
      </div>
    ))}
    <span className="sr-only">Loading…</span>
  </div>
);

export const IconMarquee = () => {
  const [state, setState] = useState({ status: "loading", categories: [] });

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: "loading" }));
    // Lazy import keeps Firebase out of the initial bundle.
    return import("../services/publicTechStackService")
      .then((service) => service.fetchPublicTechStack())
      .then((categories) => setState({ status: "ready", categories }))
      .catch(() => setState({ status: "error", categories: [] }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div id="icon-section" className="relative z-50 px-2 py-4">
      {state.status === "loading" && <Skeleton />}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-slate-400">
          Couldn't load the tech stack.{" "}
          <button type="button" onClick={load} className="text-teal-300 underline underline-offset-2 hover:text-teal-200">
            Try again
          </button>
        </p>
      )}
      {state.status === "ready" && state.categories.length === 0 && (
        <p className="text-sm text-slate-400">No technologies to show yet.</p>
      )}
      {state.status === "ready" &&
        state.categories.map((category, index) => (
          <CategoryBlock key={category.id} category={category} first={index === 0} />
        ))}
    </div>
  );
};

export default IconMarquee;
