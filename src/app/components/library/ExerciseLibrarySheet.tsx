import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Heart, Search, X } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";
import ExerciseMedia, { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { ChipGroup } from "@/shared/components/ui/chip-group";
import { useExerciseLibrary } from "@/shared/hooks/useExerciseLibrary";
import {
  EMPTY_FILTERS, EQUIPMENT, FILTER_GROUPS, MODALITIES, activeFilterCount, attribution, filterLibrary,
  similarExercises, subtitle, type LibraryExercise, type LibraryFilters,
} from "@/shared/lib/exerciseLibrary";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { LEVELS } from "@/shared/types/training";

type Facet = "groups" | "equipment" | "modalities";
const FACETS: { key: Facet; label: string; options: readonly string[] }[] = [
  { key: "groups", label: "Grupo", options: FILTER_GROUPS },
  { key: "equipment", label: "Equipo", options: EQUIPMENT },
  { key: "modalities", label: "Modalidad", options: MODALITIES },
];

/** Biblioteca de ejercicios: lista con buscador y filtros, y la ficha de cada ejercicio. */
const ExerciseLibrarySheet = ({ open, onOpenChange, userId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) => {
  const lib = useExerciseLibrary(userId, open);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [facet, setFacet] = useState<Facet | null>(null);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);

  useEffect(() => { if (!open) { setSelected(null); setFacet(null); } }, [open]);

  const items = useMemo(() => lib.items ?? [], [lib.items]);
  const results = useMemo(() => filterLibrary(items, filters), [items, filters]);
  const byId = useMemo(() => new Map(items.map((e) => [e.id, e])), [items]);
  const browsing = !filters.query.trim() && activeFilterCount(filters) === 0;

  const openExercise = (e: LibraryExercise) => {
    void hapticTap();
    setSelected(e);
    lib.markViewed(e.id);
  };
  const toggle = (key: Facet, value: string) =>
    setFilters((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Ejercicios" desktopClassName="h-[88dvh] sm:max-w-2xl">
      {selected ? (
        <ExerciseDetail
          exercise={selected}
          all={items}
          favorite={lib.favorites.has(selected.id)}
          canFavorite={lib.personal}
          onFavorite={() => void lib.toggleFavorite(selected.id)}
          onBack={() => setSelected(null)}
          onOpen={openExercise}
          byId={byId}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <label className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-card px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="Buscar ejercicio"
              aria-label="Buscar ejercicio"
              className="min-w-0 flex-1 bg-transparent type-body outline-none placeholder:text-muted-foreground"
            />
            {filters.query && (
              <button type="button" aria-label="Borrar búsqueda" onClick={() => setFilters((f) => ({ ...f, query: "" }))}>
                <X className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            )}
          </label>

          <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1">
            {FACETS.map(({ key, label }) => {
              const count = filters[key].length;
              return (
                <button
                  key={key}
                  type="button"
                  aria-expanded={facet === key}
                  onClick={() => { void hapticSelection(); setFacet((f) => (f === key ? null : key)); }}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 type-footnote font-semibold transition active:opacity-60",
                    count ? "bg-primary/15 text-primary" : "bg-secondary text-foreground",
                  )}
                >
                  {label}{count ? ` · ${count}` : ""}
                </button>
              );
            })}
            {activeFilterCount(filters) > 0 && (
              <button type="button" onClick={() => setFilters((f) => ({ ...EMPTY_FILTERS, query: f.query }))} className="h-9 shrink-0 px-2 type-footnote font-semibold text-muted-foreground">
                Quitar filtros
              </button>
            )}
          </div>

          {facet && (
            <div className="mt-3 shrink-0 motion-safe:animate-fade-in">
              <ChipGroup
                options={FACETS.find((f) => f.key === facet)!.options}
                isOn={(v) => filters[facet].includes(v)}
                onToggle={(v) => toggle(facet, v)}
              />
            </div>
          )}

          <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto px-1 pb-6">
            {lib.error ? (
              <div className="py-10 text-center">
                <p className="type-subhead text-muted-foreground">No se pudo cargar la biblioteca.</p>
                <button type="button" onClick={lib.retry} className="mt-3 h-10 rounded-full bg-secondary px-5 type-subhead font-semibold text-primary">Reintentar</button>
              </div>
            ) : !lib.items ? (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-card" />)}
              </div>
            ) : browsing ? (
              <Browse
                items={items}
                recent={lib.recent.map((id) => byId.get(id)).filter((e): e is LibraryExercise => !!e)}
                favorites={items.filter((e) => lib.favorites.has(e.id))}
                onOpen={openExercise}
                onGroup={(g) => { void hapticSelection(); setFilters((f) => ({ ...f, groups: [g] })); }}
              />
            ) : results.length === 0 ? (
              <p className="py-10 text-center type-subhead text-muted-foreground">Ningún ejercicio coincide. Prueba con otro nombre o quita algún filtro.</p>
            ) : (
              <>
                <p className="mb-2 px-1 type-footnote text-muted-foreground">{results.length} {results.length === 1 ? "ejercicio" : "ejercicios"}</p>
                <ExerciseList items={results} favorites={lib.favorites} onOpen={openExercise} />
              </>
            )}
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
};

const ExerciseList = ({ items, favorites, onOpen }: {
  items: LibraryExercise[];
  favorites?: Set<string>;
  onOpen: (e: LibraryExercise) => void;
}) => (
  <ul className="divide-y divide-border/40">
    {items.map((e) => (
      <li key={e.id}>
        <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 py-2.5 text-left transition active:opacity-60">
          <ExerciseThumb image={e.image} name={e.name} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate type-body font-medium">{e.name}</span>
            <span className="block truncate type-footnote text-muted-foreground">{subtitle(e)}</span>
          </span>
          {favorites?.has(e.id) && <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" aria-label="Favorito" />}
        </button>
      </li>
    ))}
  </ul>
);

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="mb-2 px-1 type-footnote font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
);

/** Sin búsqueda: recientes, favoritos y los grupos musculares con foto real. */
const Browse = ({ items, recent, favorites, onOpen, onGroup }: {
  items: LibraryExercise[];
  recent: LibraryExercise[];
  favorites: LibraryExercise[];
  onOpen: (e: LibraryExercise) => void;
  onGroup: (group: string) => void;
}) => {
  const groups = FILTER_GROUPS.map((g) => {
    const members = filterLibrary(items, { ...EMPTY_FILTERS, groups: [g] });
    return { g, count: members.length, image: members.find((e) => e.image)?.image ?? null };
  }).filter((x) => x.count > 0);
  return (
    <div className="space-y-6">
      {recent.length > 0 && (
        <section>
          <SectionTitle>Recientes</SectionTitle>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {recent.map((e) => (
              <button key={e.id} type="button" onClick={() => onOpen(e)} className="w-28 shrink-0 text-left transition active:opacity-60">
                <ExerciseThumb image={e.image} name={e.name} aspect="video" className="w-28" />
                <span className="mt-1.5 line-clamp-2 type-footnote font-medium">{e.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {favorites.length > 0 && (
        <section>
          <SectionTitle>Favoritos</SectionTitle>
          <ExerciseList items={favorites} onOpen={onOpen} />
        </section>
      )}
      <section>
        <SectionTitle>Grupos musculares</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {groups.map(({ g, count, image }) => (
            <button key={g} type="button" onClick={() => onGroup(g)} className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-card text-left transition active:scale-[0.98]">
              {image && <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
              <span className="absolute bottom-3 left-3 right-3">
                <span className="block type-headline font-semibold text-white">{g}</span>
                <span className="block type-footnote text-white/70">{count} {count === 1 ? "ejercicio" : "ejercicios"}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

const Bullets = ({ items, numbered }: { items: string[]; numbered?: boolean }) => {
  const List = numbered ? "ol" : "ul";
  return (
    <List className="space-y-2 rounded-[22px] bg-card p-4">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 type-subhead">
          <span className="w-5 shrink-0 font-semibold text-primary">{numbered ? i + 1 : "·"}</span>
          <span className="min-w-0 flex-1">{t}</span>
        </li>
      ))}
    </List>
  );
};

/** Ficha: héroe (clip, foto o placeholder), datos clave y secciones con contenido. */
const ExerciseDetail = ({ exercise: e, all, byId, favorite, canFavorite, onFavorite, onBack, onOpen }: {
  exercise: LibraryExercise;
  all: LibraryExercise[];
  byId: Map<string, LibraryExercise>;
  favorite: boolean;
  canFavorite: boolean;
  onFavorite: () => void;
  onBack: () => void;
  onOpen: (e: LibraryExercise) => void;
}) => {
  const [variants, setVariants] = useState<LibraryExercise[]>([]);
  useEffect(() => {
    let alive = true;
    setVariants([]);
    void supabase.from("exercise_relations").select("related_id").eq("exercise_id", e.id).eq("kind", "variant")
      .then(({ data, error }) => {
        if (!alive || error) return;
        setVariants((data ?? []).map((r) => byId.get(r.related_id)).filter((x): x is LibraryExercise => !!x));
      });
    return () => { alive = false; };
  }, [e.id, byId]);
  const alternatives = useMemo(() => similarExercises(e, all).filter((x) => !variants.some((v) => v.id === x.id)), [e, all, variants]);
  const level = LEVELS.find((l) => l.value === e.level)?.label;
  const chips = [e.primaryMuscles[0] ?? e.groups[0], e.equipment[0], level].filter(Boolean) as string[];
  const credit = attribution(e);

  return (
    <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-8 motion-safe:animate-fade-in">
      <button type="button" onClick={onBack} className="mb-3 flex h-9 items-center gap-1 rounded-full pr-3 type-subhead font-semibold text-primary active:opacity-60">
        <ChevronLeft className="h-5 w-5" aria-hidden /> Ejercicios
      </button>
      <ExerciseMedia video={e.video} image={e.image} name={e.name} emptyLabel="Demostración en preparación" className="rounded-[28px]" />
      <div className="mt-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="type-title2 font-bold tracking-tight">{e.name}</h2>
          {e.altNames.length > 0 && <p className="mt-0.5 type-subhead text-muted-foreground">{e.altNames.join(" · ")}</p>}
        </div>
        {canFavorite && (
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            onClick={() => { void hapticSelection(); onFavorite(); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary transition active:scale-95"
          >
            <Heart className={cn("h-5 w-5", favorite ? "fill-primary text-primary" : "text-foreground")} aria-hidden />
          </button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => <span key={c} className="rounded-full bg-secondary px-3 py-1.5 type-footnote font-medium">{c}</span>)}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {(e.instructions.length > 0 || e.description) && (
          <section>
            <SectionTitle>Cómo se hace</SectionTitle>
            {e.instructions.length > 0
              ? <Bullets items={e.instructions} numbered />
              : <p className="rounded-[22px] bg-card p-4 type-subhead">{e.description}</p>}
          </section>
        )}
        {(e.primaryMuscles.length > 0 || e.groups.length > 0) && (
          <section>
            <SectionTitle>Músculos</SectionTitle>
            <div className="rounded-[22px] bg-card p-4 type-subhead">
              <p><span className="text-muted-foreground">Principal: </span>{(e.primaryMuscles.length ? e.primaryMuscles : e.groups).join(", ")}</p>
              {e.secondaryMuscles.length > 0 && <p className="mt-1"><span className="text-muted-foreground">Secundarios: </span>{e.secondaryMuscles.join(", ")}</p>}
            </div>
          </section>
        )}
        {e.mistakes.length > 0 && <section><SectionTitle>Errores frecuentes</SectionTitle><Bullets items={e.mistakes} /></section>}
        {e.tips.length > 0 && <section><SectionTitle>Consejos</SectionTitle><Bullets items={e.tips} /></section>}
        {e.safety.length > 0 && <section><SectionTitle>Seguridad</SectionTitle><Bullets items={e.safety} /></section>}
        {variants.length > 0 && <section><SectionTitle>Variantes</SectionTitle><ExerciseList items={variants} onOpen={onOpen} /></section>}
        {alternatives.length > 0 && <section><SectionTitle>Alternativas</SectionTitle><ExerciseList items={alternatives} onOpen={onOpen} /></section>}
        {credit && (
          <p className="px-1 type-caption1 text-muted-foreground">
            {e.sourceUrl ? <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{credit}</a> : credit}
          </p>
        )}
      </div>
    </div>
  );
};

export default ExerciseLibrarySheet;
