import { useState } from "react";
import { Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { hapticTap } from "@/lib/native";

export default function RoadmapAdmin() {
  const ROADMAP_URL = "https://roadmap-wizardry-76.lovable.app";

  const openRoadmap = () => {
    void hapticTap();
    window.open(ROADMAP_URL, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <h2 className="type-title2">Roadmap</h2>
          <p className="type-subhead text-muted-foreground">
            Tu roadmap de desarrollo en Lovable
          </p>
        </div>
      </div>

      <ListGroup>
        <ListRow
          icon={<ExternalLink />}
          title="Abrir roadmap en Lovable"
          aria-label="Abrir roadmap"
          chevron
          onClick={openRoadmap}
        />
      </ListGroup>

      <div className="rounded-xl bg-primary/5 p-4 text-sm text-primary/80">
        <strong>¿Cómo funciona?</strong> Este roadmap se sincroniza automáticamente con Lovable. 
        Haz clic en "Abrir roadmap" para verlo y editarlo.
      </div>
    </div>
  );
}
