import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, Search, WifiOff } from "lucide-react";
import { supabase } from "@/shared/integrations/supabase/client";
import ResponsiveSheet from "@/app/components/dashboard/ResponsiveSheet";
import ExerciseMedia, { ExerciseThumb } from "@/app/components/ExerciseMedia";
import { MuscleMap } from "@/app/components/MuscleMap";
import { Button } from "@/shared/components/ui/button";
import { ChipGroup } from "@/shared/components/ui/chip-group";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { SearchPill } from "@/shared/components/ui/search-pill";
import { Spinner } from "@/shared/components/ui/spinner";
import { useExerciseLibrary } from "@/shared/hooks/useExerciseLibrary";
import {
  EMPTY_FILTERS, EQUIPMENT, FILTER_GROUPS, MODALITIES, activeFilterCount, attribution, exerciseCount, filterLibrary,
  similarExercises, subtitle, type LibraryExercise, type LibraryFilters,
} from "@/shared/lib/exerciseLibrary";
import { fastImage } from "@/shared/lib/fastImage";
import { hapticSelection, hapticTap } from "@/shared/lib/native";
import { cn } from "@/shared/lib/utils";
import { LEVELS } from "@/shared/types/training";

type Facet = "groups" | "equipment" | "modalities";
const FACETS: { key: Facet; label: string; options: readonly string[] }[] = [
  { key: "groups", label: "Grupo", options: FILTER_GROUPS },
  { key: "equipment", label: "Equipo", options: EQUIPMENT },
  { key: "modalities", label: "Modalidad", options: MODALITIES },
];

/** «Grupo · 2» se lee «Grupo: 2 filtros» (igual que `facetRow` en la app). */
const facetLabel = (label: string, count: number) => (count ? `${label}: ${count} ${count === 1 ? "filtro" : "filtros"}` : label);

/** Biblioteca de ejercicios: lista con buscador y filtros, y la ficha de cada ejercicio. */
const ExerciseLibraryBody = ({ open, userId, page }: { open: boolean; userId: string; page?: boolean }) => {
  const lib = useExerciseLibrary(userId, open);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [facet, setFacet] = useState<Facet | null>(null);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);

  useEffect(() => { if (!open) { setSelected(null); setFacet(null); } }, [open]);

  const items = useMemo(() => lib.items ?? [], [lib.items]);
  const results = useMemo(() => filterLibrary(items, filters), [items, filters]);
  const byId = useMemo(() => new Map(items.map((e) => [e.id, e])), [items]);
  const browsing = !filters.query.trim() && activeFilterCount(filters) === 0;
  const clearFilters = () => setFilters((f) => ({ ...EMPTY_FILTERS, query: f.query }));

  const openExercise = (e: LibraryExercise) => {
    void hapticTap();
    setSelected(e);
    lib.markViewed(e.id);
  };
  const toggle = (key: Facet, value: string) =>
    setFilters((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));

  return (
    <>
      {selected ? (
        <ExerciseDetail
          exercise={selected}
          all={items}
          favorites={lib.favorites}
          favorite={lib.favorites.has(selected.id)}
          canFavorite={lib.personal}
          onFavorite={() => void lib.toggleFavorite(selected.id)}
          onBack={() => setSelected(null)}
          onOpen={openExercise}
          byId={byId}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Subtítulo bajo el título grande, como en el iPhone (en escritorio la barra lleva su pista). */}
          {page && <p className="-mt-3 mb-4 type-subhead text-muted-foreground md:hidden">Técnica, músculos y variantes de cada ejercicio.</p>}
          <SearchPill value={filters.query} onChange={(query) => setFilters((f) => ({ ...f, query }))} placeholder="Buscar ejercicio" />

          <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {FACETS.map(({ key, label }) => {
              const count = filters[key].length;
              return (
                <button
                  key={key}
                  type="button"
                  aria-expanded={facet === key}
                  aria-label={facetLabel(label, count)}
                  onClick={() => { void hapticSelection(); setFacet((f) => (f === key ? null : key)); }}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 type-footnote font-semibold tabular-nums transition active:opacity-60",
                    count ? "bg-primary/15 text-primary" : "bg-secondary text-foreground",
                  )}
                >
                  {label}{count ? ` · ${count}` : ""}
                </button>
              );
            })}
            {activeFilterCount(filters) > 0 && (
              <button type="button" onClick={clearFilters} className="h-10 shrink-0 px-3 type-footnote font-semibold text-muted-foreground active:opacity-60">
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

          <div className="-mx-1 mt-5 min-h-0 flex-1 overflow-y-auto px-1 pb-6">
            {/* Sin conexión o sin nada que leer (lista vacía): el mismo aviso con «Reintentar», nunca un título sin tarjetas. */}
            {lib.error || lib.items?.length === 0 ? (
              <EmptyState
                icon={WifiOff}
                title="No hemos podido cargar los ejercicios"
                description="Revisa tu conexión y vuelve a intentarlo."
                action={<Button type="button" variant="secondary" size="lg" onClick={lib.retry}>Reintentar</Button>}
              />
            ) : !lib.items ? (
              // Carga con la firma de marca (el AP latiendo), nunca bloques grises.
              <div className="flex justify-center py-16" aria-busy="true">
                <Spinner size="lg" label="Cargando ejercicios" />
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
              <EmptyState
                icon={Search}
                title="Prueba con otro nombre"
                description="Busca por ejercicio o músculo, o quita algún filtro."
                action={activeFilterCount(filters) > 0
                  ? <Button type="button" variant="secondary" size="lg" onClick={clearFilters}>Quitar filtros</Button>
                  : undefined}
              />
            ) : (
              <>
                <p role="status" className="mb-2.5 px-1 type-footnote tabular-nums text-muted-foreground">{exerciseCount(results.length)}</p>
                <ExerciseList items={results} favorites={lib.favorites} onOpen={openExercise} />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

/** La biblioteca como hoja (desde la rutina o el entreno). */
const ExerciseLibrarySheet = ({ open, onOpenChange, userId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) => (
  <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Ejercicios" desktopClassName="h-[88dvh] sm:max-w-2xl">
    <ExerciseLibraryBody open={open} userId={userId} />
  </ResponsiveSheet>
);

/** La biblioteca como pestaña «Ejercicios» de la navegación, igual que en el iPhone. El título
 *  lo pinta la barra de la app, como en el resto de pestañas. */
export const ExerciseLibraryPage = ({ userId }: { userId: string }) => (
  <section aria-label="Ejercicios" className="mx-auto flex w-full max-w-[680px] flex-col">
    <ExerciseLibraryBody open userId={userId} page />
  </section>
);

/** Filas en un grupo sin borde (como «Comidas de hoy»): miniatura, nombre, músculo y equipo, y chevron. */
const ExerciseList = ({ items, favorites, onOpen }: {
  items: LibraryExercise[];
  favorites?: Set<string>;
  onOpen: (e: LibraryExercise) => void;
}) => (
  <ul className="overflow-hidden rounded-[22px] bg-card">
    {items.map((e) => (
      <li key={e.id} className="group/row">
        <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 pl-3 text-left transition-colors duration-150 active:bg-accent">
          <span className="py-2.5"><ExerciseThumb image={e.image} video={e.video} name={e.name} pattern={e.pattern} stimulus={e.stimulus} load={e.load} muscleGroup={e.groups[0]} size="md" /></span>
          {/* El separador nace donde empieza el texto, como en ListRow. */}
          <span className="flex min-w-0 flex-1 items-center gap-2 self-stretch py-2.5 pr-3 group-[:not(:last-child)]/row:sep-b">
            <span className="min-w-0 flex-1">
              <span className="block truncate type-headline">{e.name}</span>
              <span className="block truncate type-footnote text-muted-foreground">{subtitle(e)}</span>
            </span>
            {favorites?.has(e.id) && <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" aria-label="Favorito" />}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
          </span>
        </button>
      </li>
    ))}
  </ul>
);

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="mb-3 type-title3">{children}</h3>
);

/**
 * Tarjeta de grupo muscular: la foto real de uno de sus ejercicios con su degradado (a 640 px, la
 * misma petición que la app) o, si el grupo aún no tiene ninguna, la silueta con ese músculo en
 * dorado. Nunca un bloque vacío. Como `groupTile` en la app.
 */
const GroupTile = ({ group, count, image, onSelect }: { group: string; count: number; image: string | null; onSelect: () => void }) => {
  const [broken, setBroken] = useState(false);
  const photo = image && !broken ? image : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${group}, ${exerciseCount(count)}`}
      className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-card text-left transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {photo ? (
        <>
          <img src={fastImage(photo, 500)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
        </>
      ) : (
        <span aria-hidden className="absolute inset-x-0 top-0 bottom-12 flex items-center justify-center">
          <MuscleMap primary={[group]} size={40} dots={false} />
        </span>
      )}
      <span aria-hidden className="absolute bottom-3 left-3 right-3">
        <span className={cn("block truncate type-headline", photo ? "text-white" : "text-foreground")}>{group}</span>
        <span className={cn("block truncate type-footnote tabular-nums", photo ? "text-white/75" : "text-muted-foreground")}>{exerciseCount(count)}</span>
      </span>
    </button>
  );
};

/** Sin búsqueda: recientes, favoritos y los grupos musculares con foto real o la silueta con su músculo. */
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
    <div className="space-y-8">
      {recent.length > 0 && (
        <section>
          <SectionTitle>Recientes</SectionTitle>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {recent.map((e) => (
              <button key={e.id} type="button" onClick={() => onOpen(e)} className="w-28 shrink-0 text-left transition-opacity active:opacity-60">
                <ExerciseThumb image={e.image} video={e.video} name={e.name} pattern={e.pattern} stimulus={e.stimulus} load={e.load} muscleGroup={e.groups[0]} aspect="video" className="w-28" />
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
            <GroupTile key={g} group={g} count={count} image={image} onSelect={() => onGroup(g)} />
          ))}
        </div>
      </section>
    </div>
  );
};

/** Pasos con su número en un círculo dorado tenue; el resto, con un punto dorado. */
const Bullets = ({ items, numbered }: { items: string[]; numbered?: boolean }) => {
  const List = numbered ? "ol" : "ul";
  return (
    <List className="space-y-3 rounded-[22px] bg-card p-4">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 type-subhead">
          {numbered
            ? <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 type-footnote font-bold tabular-nums text-primary">{i + 1}</span>
            : <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          <span className={cn("min-w-0 flex-1", numbered && "pt-0.5")}>{t}</span>
        </li>
      ))}
    </List>
  );
};

/**
 * Ficha: héroe (clip, foto o la silueta con su músculo), el nombre grande con sus datos clave, las
 * secciones en Title 3 con aire entre ellas y, al final, la acción (favoritos) y la autoría.
 */
const ExerciseDetail = ({ exercise: e, all, byId, favorites, favorite, canFavorite, onFavorite, onBack, onOpen }: {
  exercise: LibraryExercise;
  all: LibraryExercise[];
  byId: Map<string, LibraryExercise>;
  favorites: Set<string>;
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
      <button type="button" onClick={onBack} className="mb-3 flex h-11 items-center gap-1 rounded-full pr-3 type-subhead font-semibold text-primary active:opacity-60">
        <ChevronLeft className="h-5 w-5" aria-hidden /> Ejercicios
      </button>
      {/* El clip en bucle sobre su foto, la foto sola o, sin foto, la silueta con su músculo a todo el héroe. */}
      <ExerciseMedia key={e.id} video={e.video} image={e.image} name={e.name} pattern={e.pattern} stimulus={e.stimulus} load={e.load} muscleGroup={e.groups[0]} className="rounded-sheet bg-card" />
      {/* Nombre grande (Title 1 que crece con el tamaño de letra, como `.apTitle1` en la app) y sus datos clave. */}
      <div className="mt-5">
        <h2 className="break-words type-title1">{e.name}</h2>
        {e.altNames.length > 0 && <p className="mt-1 type-subhead text-muted-foreground">{e.altNames.join(" · ")}</p>}
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => <span key={c} className="rounded-full bg-secondary px-3 py-1.5 type-footnote font-medium">{c}</span>)}
        </div>
      )}

      <div className="mt-8 space-y-8">
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
            <dl className="overflow-hidden rounded-[22px] bg-card px-4">
              <div className="py-3">
                <dt className="type-footnote text-muted-foreground">Principal</dt>
                <dd className="mt-0.5 type-headline">{(e.primaryMuscles.length ? e.primaryMuscles : e.groups).join(", ")}</dd>
              </div>
              {e.secondaryMuscles.length > 0 && (
                <div className="sep-t py-3">
                  <dt className="type-footnote text-muted-foreground">Secundarios</dt>
                  <dd className="mt-0.5 type-headline">{e.secondaryMuscles.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        {e.mistakes.length > 0 && <section><SectionTitle>Errores frecuentes</SectionTitle><Bullets items={e.mistakes} /></section>}
        {e.tips.length > 0 && <section><SectionTitle>Consejos</SectionTitle><Bullets items={e.tips} /></section>}
        {e.safety.length > 0 && <section><SectionTitle>Seguridad</SectionTitle><Bullets items={e.safety} /></section>}
        {variants.length > 0 && <section><SectionTitle>Variantes</SectionTitle><ExerciseList items={variants} favorites={favorites} onOpen={onOpen} /></section>}
        {alternatives.length > 0 && <section><SectionTitle>Alternativas</SectionTitle><ExerciseList items={alternatives} favorites={favorites} onOpen={onOpen} /></section>}
        {/* Acciones al final, después de leer la ficha: guardar en favoritos (solo con cuenta). */}
        {canFavorite && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => { void hapticSelection(); onFavorite(); }}
          >
            <Heart className={cn(favorite ? "fill-primary text-primary" : "text-foreground")} aria-hidden />
            {favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          </Button>
        )}
        {/* Autor y licencia solo cuando la licencia lo exige (CC BY / BY-SA). */}
        {credit && (
          <p className="px-1 type-footnote text-muted-foreground">
            {e.sourceUrl ? <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{credit}</a> : credit}
          </p>
        )}
      </div>
    </div>
  );
};

export default ExerciseLibrarySheet;
