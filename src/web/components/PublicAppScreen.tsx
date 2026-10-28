import { Check, ChevronRight, Dumbbell } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ProgressRing } from "@/shared/components/ui/progress-ring";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import ExerciseProgressChart from "@/app/components/dashboard/ExerciseProgressChart";
import { previewExercises, previewHistory } from "@/web/components/previewData";

/** Read-only public examples. Same chart and controls as the actual app; no account writes. */
export function PublicProgressScreen() {
  return <div className="px-4 pt-2">
    <h2 className="type-large-title">Progreso</h2>
    <Tabs defaultValue="evolution" className="mt-5">
      <TabsList className="w-full"><TabsTrigger value="evolution">Fuerza</TabsTrigger><TabsTrigger value="photos">Físico</TabsTrigger><TabsTrigger value="records">Récords</TabsTrigger><TabsTrigger value="scan">Scan</TabsTrigger></TabsList>
    </Tabs>
    <p className="mt-6 type-title3">Sentadilla goblet</p>
    <div className="mt-5 h-72"><ExerciseProgressChart exerciseName="Sentadilla goblet" history={previewHistory} metric="bestEstimated1RmKg" onMetricChange={() => undefined} compact /></div>
    <p className="mt-6 type-footnote text-muted-foreground">Datos de ejemplo</p>
  </div>;
}

export function PublicTrainingScreen({ active = false }: { active?: boolean }) {
  const exercise = previewExercises[0];
  return <div className="flex h-full min-h-0 flex-col px-4 pt-2">
    <h2 className="type-large-title">Entrenar</h2>
    <p className="mt-5 type-title1">Fuerza cuerpo completo</p>
    <p className="mt-1 type-subhead text-muted-foreground">3 ejercicios · 9 series · unos 20 min</p>
    {active ? <>
      <img src={exercise.image} alt="Sentadilla goblet" className="mt-5 aspect-[4/3] max-h-40 w-full rounded-2xl bg-card object-contain" loading="lazy" decoding="async" />
      <p className="mt-4 type-title3">{exercise.name}</p>
      <div className="mt-4 grid grid-cols-[24px_52px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 type-caption2 text-muted-foreground"><span>#</span><span>Anterior</span><span className="text-center">kg</span><span className="text-center">Reps</span><span /></div>
      {[0, 1, 2].map(i => <div key={i} className="mt-2 grid grid-cols-[24px_52px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2">
        <span className="type-subhead text-muted-foreground">{i + 1}</span><span className="type-caption2 tabular-nums text-muted-foreground">18 × 10</span>
        <span className="rounded-full bg-secondary py-3 text-center type-body tabular-nums">20</span><span className="rounded-full bg-secondary py-3 text-center type-body tabular-nums">9</span>
        <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${i < 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}><Check className="h-[18px] w-[18px]" strokeWidth={3} /></span>
      </div>)}
      <div className="mt-auto pb-6 pt-5"><div className="flex items-center justify-between"><span className="font-rounded type-title1 tabular-nums">1:24</span><span className="type-body text-primary">−30</span><span className="type-body text-primary">+30</span><span className="type-body text-primary">Omitir</span></div><Button className="mt-4 w-full" variant="secondary" tabIndex={-1}>Terminar entreno</Button></div>
    </> : <>
      <div className="mt-6 overflow-hidden rounded-2xl bg-card">{previewExercises.map(ex => <div key={ex.name} className="flex items-center gap-3 p-4"><img src={ex.image} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-secondary object-contain" loading="lazy" decoding="async" /><div className="min-w-0 flex-1"><p className="type-headline">{ex.name}</p><p className="type-footnote text-muted-foreground">{ex.sets} × {ex.reps} · {ex.load}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></div>)}</div>
      <Button className="mt-5 w-full" size="lg" tabIndex={-1}><Dumbbell className="mr-2 h-5 w-5" />Empezar entreno</Button>
    </>}
  </div>;
}

export function PublicBasicNutrition() {
  return <section className="space-y-8 py-4">
    <h2 className="type-title1">Tus objetivos diarios</h2>
    <div className="flex flex-wrap items-center gap-6">
      <ProgressRing value={100} size={144} stroke={14} label="Objetivo: 2.300 kcal al día"><span className="flex flex-col items-center"><span className="font-rounded type-title1 tabular-nums">2.300</span><span className="mt-1 type-footnote text-muted-foreground">kcal / día</span></span></ProgressRing>
      <div className="flex items-center gap-3"><ProgressRing value={100} size={64} stroke={7} label="Proteína: 150 g al día"><span className="type-headline tabular-nums">150</span></ProgressRing><div><p className="type-headline">150 g</p><p className="type-subhead text-muted-foreground">proteína / día</p></div></div>
    </div>
    <p className="type-footnote text-muted-foreground">Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual.</p>
    <Button variant="plain" tabIndex={-1}>Actualizar mis datos</Button>
  </section>;
}