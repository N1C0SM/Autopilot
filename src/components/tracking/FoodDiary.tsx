import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackingDb } from "@/lib/tracking/store";
import { toLocalDateString } from "@/lib/localDates";
import {
  nutrients,
  nutritionTotals,
  type Consumption,
  type FoodRecord,
} from "@/lib/tracking/nutrition";
const labels = {
  calories: "Calorías (kcal)",
  protein: "Proteína (g)",
  carbs: "Carbohidratos (g)",
  fats: "Grasas (g)",
};
export default function FoodDiary({
  userId,
  meals,
  readOnly = false,
}: {
  userId: string;
  meals: Array<{ name: string; description: string }>;
  readOnly?: boolean;
}) {
  const [date, setDate] = useState(toLocalDateString()),
    [entries, setEntries] = useState<
      Array<{ id: string; payload: Consumption }>
    >([]),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [reload, setReload] = useState(0);
  const [meal, setMeal] = useState(""),
    [planned, setPlanned] = useState(""),
    [notes, setNotes] = useState(""),
    [level, setLevel] = useState<"checkin" | "weighed">("weighed");
  const blank: FoodRecord = {
    name: "",
    grams: 100,
    source: "",
    calories: null,
    protein: null,
    carbs: null,
    fats: null,
  };
  const [food, setFood] = useState(blank),
    [id, setId] = useState<string>(() => crypto.randomUUID());
  useEffect(() => {
    let active = true;
    setReady(false);
    setEntries([]);
    trackingDb
      .from("nutrition_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("local_date", date)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError("No se pudo cargar el consumo.");
          return;
        }
        setEntries(
          (data || []).map((r) => ({
            id: r.id,
            payload: r.payload as unknown as Consumption,
          })),
        );
        setError("");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [userId, date, reload]);
  const save = async () => {
    if (
      !meal.trim() ||
      (level === "weighed" &&
        (!food.name.trim() ||
          food.grams <= 0 ||
          !Number.isFinite(food.grams) ||
          nutrients.some(
            (n) =>
              food[n] !== null && (!Number.isFinite(food[n]) || food[n]! < 0),
          )))
    ) {
      setError("Revisa el nombre, la cantidad y los valores nutricionales.");
      return;
    }
    setSaving(true);
    const payload: Consumption = {
      meal,
      planned: planned || null,
      level,
      foods: level === "weighed" ? [food] : [],
      notes,
    };
    try {
      const { error } = await trackingDb.from("nutrition_entries").upsert(
        {
          id,
          user_id: userId,
          local_date: date,
          payload: JSON.parse(JSON.stringify(payload)),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      setEntries((e) => [...e.filter((r) => r.id !== id), { id, payload }]);
      setId(crypto.randomUUID());
      setFood(blank);
      setMeal("");
      setNotes("");
      setError("");
    } catch {
      setError("No se guardó. Puedes reintentar sin duplicar el registro.");
    } finally {
      setSaving(false);
    }
  };
  const totals = nutritionTotals(entries.map((e) => e.payload));
  return (
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      <h3 className="font-bold text-lg">Alimentación registrada</h3>
      <label className="block text-sm">
        Fecha
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert">
          {error}{" "}
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            Recargar
          </Button>
        </p>
      )}
      {!ready && !error && <p>Cargando consumo…</p>}
      <div className="grid grid-cols-2 gap-2">
        {nutrients.map((n) => (
          <div className="rounded-xl bg-secondary/40 p-3" key={n}>
            <strong>{totals[n].known}</strong> {labels[n]}
            <p className="text-xs">
              {totals[n].missing
                ? "Subtotal: hay datos sin cuantificar"
                : "Según cantidades registradas"}
            </p>
          </div>
        ))}
      </div>
      {entries.map((e) => (
        <div className="border-b py-2" key={e.id}>
          <strong>{e.payload.meal}</strong>
          <p className="text-sm">
            {e.payload.planned
              ? `Previsto: ${e.payload.planned}`
              : "Comida adicional"}{" "}
            ·{" "}
            {e.payload.level === "checkin"
              ? "Marcada, sin cantidades ni macros"
              : e.payload.foods
                  .map((f) => `${f.name}: ${f.grams} g`)
                  .join(", ")}
          </p>
          <p className="text-xs">{e.payload.notes}</p>
          {!readOnly && (
            <Button
              variant="ghost"
              onClick={() => {
                setId(e.id);
                setMeal(e.payload.meal);
                setPlanned(e.payload.planned || "");
                setLevel(e.payload.level);
                setFood(e.payload.foods[0] || blank);
                setNotes(e.payload.notes);
              }}
            >
              Corregir
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <fieldset disabled={!ready || saving} className="space-y-3">
          <h4 className="font-semibold">Añadir consumo o sustitución</h4>
          <label className="block text-sm">
            Comida prevista
            <select
              className="h-11 w-full border rounded-md bg-background"
              value={planned}
              onChange={(e) => {
                setPlanned(e.target.value);
                setMeal(e.target.value.split(":")[0]);
              }}
            >
              <option value="">Comida adicional</option>
              {meals.map((m, i) => (
                <option key={i} value={`${m.name}: ${m.description}`}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Nombre de la comida
            <Input value={meal} onChange={(e) => setMeal(e.target.value)} />
          </label>
          <label className="block text-sm">
            Nivel de seguimiento
            <select
              className="h-11 w-full border rounded-md bg-background"
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
            >
              <option value="weighed">Alimento y cantidad</option>
              <option value="checkin">Solo marcar comida</option>
            </select>
          </label>
          {level === "weighed" && (
            <>
              <p className="text-xs">
                Añade cada alimento por separado. Copia los valores por 100 g de
                su etiqueta o de una fuente nutricional identificada. Deja en
                blanco los valores desconocidos.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Alimento consumido
                  <Input
                    value={food.name}
                    onChange={(e) =>
                      setFood((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label className="text-sm">
                  Gramos consumidos
                  <Input
                    type="number"
                    min="0.1"
                    value={food.grams}
                    onChange={(e) =>
                      setFood((f) => ({ ...f, grams: Number(e.target.value) }))
                    }
                  />
                </label>
                <label className="text-sm col-span-2">
                  Fuente (etiqueta, marca o referencia)
                  <Input
                    value={food.source}
                    onChange={(e) =>
                      setFood((f) => ({ ...f, source: e.target.value }))
                    }
                  />
                </label>
                {nutrients.map((n) => (
                  <label key={n} className="text-sm">
                    {labels[n]} / 100 g
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={food[n] ?? ""}
                      onChange={(e) =>
                        setFood((f) => ({
                          ...f,
                          [n]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          <label className="block text-sm">
            Notas / sustitución
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <Button onClick={() => void save()}>
            {saving ? "Guardando…" : "Guardar consumo"}
          </Button>
        </fieldset>
      )}
      <p className="text-xs text-muted-foreground">
        Marcar una comida indica seguimiento sencillo: no acredita cantidades ni
        calorías consumidas. Los valores desconocidos no se inventan.
      </p>
    </section>
  );
}
