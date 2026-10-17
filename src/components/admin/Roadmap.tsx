import { useState } from "react";
import { Info, Check, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";
import { useRoadmapStore } from "@/lib/roadmap/store";
import type { VersionStage } from "@/lib/roadmap/types";

export default function RoadmapAdmin() {
  const { roadmap, setVersionStage, setFeatureStatus } = useRoadmapStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const togglePhase = (phaseNum: number) => {
    const next = new Set(expanded);
    if (next.has(String(phaseNum))) {
      next.delete(String(phaseNum));
    } else {
      next.add(String(phaseNum));
    }
    setExpanded(next);
  };

  const formatStage = (stage: VersionStage): string => {
    const labels: Record<VersionStage, string> = {
      planned: "Planificada",
      internal: "Interna",
      beta1: "Beta 1",
      beta2: "Beta 2",
      rc: "RC",
      released: "Lanzada",
    };
    return labels[stage] || stage;
  };

  const stageColor = (stage: VersionStage): string => {
    const colors: Record<VersionStage, string> = {
      planned: "text-muted-foreground",
      internal: "text-primary",
      beta1: "text-amber-500",
      beta2: "text-amber-600",
      rc: "text-orange-600",
      released: "text-emerald-600",
    };
    return colors[stage] || "text-muted-foreground";
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h2 className="type-title2">Roadmap</h2>
            <p className="type-subhead text-muted-foreground">
              {roadmap.name} · {roadmap.versions.length} versiones
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setVersionStage("v1.0", "beta1")}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Revertir a Beta 1
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {roadmap.phases.map((phase) => {
          const versionsInPhase = roadmap.versions.filter((v) => v.phase === phase.num);
          const isExpanded = expanded.has(String(phase.num));

          return (
            <div key={phase.num} className="rounded-2xl border bg-card p-6 shadow-sm">
              {/* Phase header */}
              <div
                className="flex cursor-pointer items-center justify-between gap-4"
                onClick={() => togglePhase(phase.num)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="type-title3 font-bold text-primary">{phase.num}</span>
                    <span className="type-subhead text-foreground">{phase.name}</span>
                  </div>
                </div>

                <Info
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>

              {/* Versions */}
              {isExpanded && (
                <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {versionsInPhase.map((version) => {
                    const totalFeatures = version.features.length;
                    const doneFeatures = version.features.filter((f) => f.status === "done").length;
                    const percentage = totalFeatures > 0 ? Math.round((doneFeatures / totalFeatures) * 100) : 0;

                    return (
                      <div
                        key={version.id}
                        className="rounded-xl border border-border/50 bg-secondary/30 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="type-title3 font-bold">{version.number}</span>
                              <span className={`type-footnote font-medium ${stageColor(version.stage)}`}>
                                {formatStage(version.stage)}
                              </span>
                            </div>
                            <p className="type-subhead text-foreground">{version.name}</p>
                            <p className="type-caption1 text-muted-foreground mt-1">
                              {version.focus}
                            </p>
                          </div>

                          {/* Progress */}
                          <div className="shrink-0 w-24">
                            <div className="h-2 w-full rounded-full bg-secondary/50">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="type-footnote tabular-nums text-muted-foreground mt-1 block">
                              {percentage}% · {doneFeatures}/{totalFeatures}
                            </span>
                          </div>
                        </div>

                        {/* Features */}
                        <div className="mt-3 space-y-2">
                          {version.features.slice(0, 3).map((feature) => (
                            <div
                              key={feature.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className={`truncate ${feature.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {feature.title}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="type-footnote tabular-nums text-muted-foreground">
                                  {feature.complexity}
                                </span>
                                <button
                                  onClick={() => setFeatureStatus(feature.id, feature.status === "done" ? "todo" : "done")}
                                  className={`h-5 w-5 rounded flex items-center justify-center transition-colors ${
                                    feature.status === "done"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-secondary hover:bg-primary/10"
                                  }`}
                                >
                                  {feature.status === "done" && <Check className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>
                          ))}
                          {version.features.length > 3 && (
                            <p className="type-caption1 text-muted-foreground pl-1">
                              +{version.features.length - 3} más
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="mt-3 flex gap-2 pt-2 border-t border-border/50">
                          <select
                            value={version.stage}
                            onChange={(e) => setVersionStage(version.id, e.target.value as VersionStage)}
                            className="type-footnote rounded-md border border-border bg-secondary px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="planned">Planificada</option>
                            <option value="internal">Interna</option>
                            <option value="beta1">Beta 1</option>
                            <option value="beta2">Beta 2</option>
                            <option value="rc">RC</option>
                            <option value="released">Lanzada</option>
                          </select>

                          <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setVersionStage(version.id, "beta1")}>
                            <Zap className="h-3 w-3 mr-1" />
                            Beta 1
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {versionsInPhase.length === 0 && (
                    <p className="type-subhead text-muted-foreground text-center py-4">
                      No hay versiones programadas para esta fase
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-primary/5 p-4 text-sm text-primary/80">
        <strong>¿Cómo funciona?</strong> Este roadmap está sincronizado con el código de GitHub.
        Los commits con convención como <code className="bg-primary/20 px-1 rounded">feat(1.0):</code>
        marcan las funciones automáticamente.
      </div>
    </div>
  );
}
