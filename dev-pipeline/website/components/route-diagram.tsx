import { ArrowRight } from "lucide-react";
import { routeDefinitions } from "@/lib/content";

const separatorStyles: Record<string, string> = {
  "Phase 0 → 2 → 6": "最佳入门",
  "Phase 0 → 1 → 2 → 5 → 6": "团队默认",
  "Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7": "高保障",
};

export function RouteDiagram() {
  return (
    <div className="route-grid">
      {routeDefinitions.map((route, index) => {
        const steps = route.phases.split("→").map((step) => step.trim());
        const tag = separatorStyles[route.phases] ?? "";
        return (
          <article className="route-card" key={route.id}>
            <header>
              <span className="route-rank">0{index + 1}</span>
              <div>
                <h3>
                  <route.icon aria-hidden="true" />
                  {route.label}
                  <small>route.{route.id}</small>
                </h3>
                <p>{route.use}</p>
              </div>
              <span className="route-tag">{tag}</span>
            </header>
            <div className="route-strip" aria-label={`${route.label} 包含的 Phase`}>
              {steps.map((step, idx) => (
                <span className="route-chip" key={`${route.id}-${step}-${idx}`}>
                  <b>{step}</b>
                  {idx < steps.length - 1 ? <ArrowRight aria-hidden="true" /> : null}
                </span>
              ))}
            </div>
            <footer>
              <span>{route.upgrade}</span>
              <span className="route-upgrade">
                <ArrowRight aria-hidden="true" />
                只能升级
              </span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}