import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Apple, ArrowRight, Bell, Check, Dumbbell, Home, LineChart, MessageCircle,
  RotateCcw, Send, Settings as SettingsIcon, Sparkles, Timer, Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

const views = [
  { key: "home", label: "Hoy", icon: Home },
  { key: "training", label: "Plan", icon: Dumbbell },
  { key: "nutrition", label: "Nutrición", icon: Apple },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "progress", label: "Progreso", icon: Sparkles },
] as const;
type View = (typeof views)[number]["key"];

const titles: Record<View, string> = {
  home: "Hoy",
  training: "Tu plan",
  nutrition: "Nutrición",
  chat: "Tu entrenador",
  progress: "Progreso",
};

const exercises = [
  { name: "Sentadilla goblet", sets: "3 × 8–10", load: "20 kg", last: "Última vez: 18 kg × 10" },
  { name: "Remo con mancuerna", sets: "3 × 10–12", load: "16 kg", last: "Última vez: 14 kg × 12" },
  { name: "Press con mancuernas", sets: "3 × 8–10", load: "14 kg", last: "Última vez: 14 kg × 8" },
];

const side: Record<View, { title: string; points: string[] }> = {
  home: {
    title: "Abres la app y sabes qué toca hoy.",
    points: ["Tu sesión del día, tu comida y tu peso en una pantalla.", "Nada de buscar entre menús: entras y entrenas.", "Tu entrenador ve tu actividad sin que tú escribas nada."],
  },
  training: {
    title: "Sabes qué hacer al entrar al gimnasio.",
    points: ["Series, repeticiones y peso sugerido para cada ejercicio.", "Ves lo que levantaste la última vez para progresar.", "Si la máquina está ocupada, pides una alternativa a tu entrenador."],
  },
  nutrition: {
    title: "Comes con un objetivo claro, sin contar a ciegas.",
    points: ["Calorías y macros del día de un vistazo.", "Comidas preparadas por tu entrenador, adaptables a tus gustos.", "Cambias una comida sin romper el plan."],
  },
  chat: {
    title: "Una persona real al otro lado.",
    points: ["Dudas, molestias o cambios: se lo dices a tu entrenador.", "Te responde y ajusta tu plan, no un robot.", "También puedes enviar fotos y vídeos de técnica."],
  },
  progress: {
    title: "Ves que avanzas, y tu entrenador también.",
    points: ["Peso, medidas y fotos en un mismo lugar.", "Constancia semanal sin tener que apuntarlo tú.", "Tu entrenador revisa los datos y ajusta el plan."],
  },
};

const weights = [82.4, 82.1, 81.9, 81.6, 81.7, 81.2, 80.9, 80.6];

const chatMessages: { from: "trainer" | "me"; text: string; time: string }[] = [
  { from: "trainer", text: "¿Qué tal la sentadilla de ayer? ¿Te sobraron repeticiones?", time: "9:12" },
  { from: "me", text: "Sí, las dos últimas salieron bien. La máquina de remo estaba ocupada eso sí", time: "9:15" },
  { from: "trainer", text: "Perfecto, sube a 20 kg la próxima. Para el remo te dejo alternativa con mancuerna en el plan 👍", time: "9:16" },
];

/** Public, isolated example. Never reads or writes a customer's training data. */
export default function ProductPreview({ onPlans, onFree }: { onPlans: () => void; onFree?: () => void }) {
  const [view, setView] = useState<View>("home");
  const [completed, setCompleted] = useState<string[]>([]);
  const pct = Math.round((completed.length / exercises.length) * 100);
  const max = Math.max(...weights), min = Math.min(...weights);
  const path = weights.map((w, i) => `${(i / (weights.length - 1)) * 100},${((max - w) / (max - min)) * 36 + 4}`).join(" ");

  const changeView = (key: View) => { setView(key); track("plan_preview_view", { source: "public_demo", section: key }); };

  return (
    <section id="ver-app" aria-labelledby="preview-heading" className="scroll-mt-24 border-y border-border px-4 py-16 sm:py-20">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Antes de decidir</p>
            <h2 id="preview-heading" className="font-display text-3xl font-bold sm:text-4xl">Prueba cómo sería tu día.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explora un ejemplo de la app: marca ejercicios y descubre cómo se muestran el plan, la nutrición y el chat. Sin cuenta, sin tarjeta.</p>
          </div>
          <span className="text-xs text-muted-foreground">Demo con datos ficticios · no es un plan personal</span>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[1fr_22rem]">
          <div className="order-2 md:order-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <h3 className="font-display text-2xl font-bold">{side[view].title}</h3>
                <ul className="mt-5 space-y-3">
                  {side[view].points.map(p => (
                    <li key={p} className="flex gap-3 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{p}</li>
                  ))}
                </ul>
                <p className="mt-6 max-w-md text-sm text-muted-foreground">{view === "nutrition" ? "Nutrición personalizada incluida en Completo · 49€/mes tras la prueba." : view === "chat" ? "Chat en los planes de pago: respuesta en 48h con Entrenamiento y en 24h con Completo." : "Gratis incluye rutina inicial y registro. Los planes de pago añaden un entrenador que prepara y revisa tu plan."}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* iPhone frame */}
          <div className="order-1 mx-auto w-full max-w-[22rem] md:order-2">
            <div className="relative rounded-[3.25rem] bg-neutral-900 p-[3px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] ring-1 ring-neutral-700/60">
              {/* side buttons */}
              <span aria-hidden className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l-md bg-neutral-700" />
              <span aria-hidden className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-md bg-neutral-700" />
              <span aria-hidden className="absolute -left-[2px] top-52 h-12 w-[3px] rounded-l-md bg-neutral-700" />
              <span aria-hidden className="absolute -right-[2px] top-40 h-16 w-[3px] rounded-r-md bg-neutral-700" />

              <div className="relative flex h-[37rem] flex-col overflow-hidden rounded-[3rem] bg-background ring-1 ring-black/40">
                {/* status bar + dynamic island */}
                <div className="relative flex items-center justify-between px-7 pb-1 pt-3 text-[11px] font-semibold">
                  <span>9:41</span>
                  <span aria-hidden className="absolute left-1/2 top-2 h-[26px] w-28 -translate-x-1/2 rounded-full bg-black" />
                  <span className="flex items-center gap-1.5" aria-hidden>
                    <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current"><rect x="0" y="7" width="3" height="5" rx="0.5"/><rect x="4.5" y="5" width="3" height="7" rx="0.5"/><rect x="9" y="2.5" width="3" height="9.5" rx="0.5"/><rect x="13" y="0" width="3" height="12" rx="0.5"/></svg>
                    <svg viewBox="0 0 24 12" className="h-3 w-6"><rect x="0.5" y="0.5" width="20" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.4"/><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor"/><rect x="22" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.4"/></svg>
                  </span>
                </div>

                {/* app header (same as real app) */}
                <header className="flex h-12 items-center gap-3 border-b border-border px-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold ring-1 ring-border">M</span>
                  <h1 className="flex-1 truncate text-center font-display text-sm font-bold">{titles[view]}</h1>
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <Bell className="h-4 w-4" />
                    <SettingsIcon className="h-4 w-4" />
                  </span>
                </header>

                {/* content */}
                <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>

                      {view === "home" && (
                        <div className="space-y-3">
                          <p className="text-[11px] font-medium text-primary">Lunes 28 · Semana 3 de 12</p>
                          <h4 className="font-display text-xl font-bold leading-tight">Hola, Marta.<br />Hoy toca fuerza.</h4>
                          <button type="button" onClick={() => changeView("training")} className="flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground transition-opacity hover:opacity-90">
                            <Dumbbell className="h-6 w-6 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold">Fuerza cuerpo completo</span>
                              <span className="block text-xs opacity-80">{exercises.length} ejercicios · ~45 min</span>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => changeView("nutrition")} className="rounded-2xl border border-border p-3 text-left transition-colors hover:bg-secondary">
                              <Utensils className="mb-1.5 h-4 w-4 text-primary" />
                              <p className="text-xs font-semibold">Nutrición</p>
                              <p className="text-[10px] text-muted-foreground">1.420 / 2.300 kcal</p>
                            </button>
                            <button type="button" onClick={() => changeView("progress")} className="rounded-2xl border border-border p-3 text-left transition-colors hover:bg-secondary">
                              <LineChart className="mb-1.5 h-4 w-4 text-primary" />
                              <p className="text-xs font-semibold">Peso</p>
                              <p className="text-[10px] text-muted-foreground">80,6 kg · −1,8 kg</p>
                            </button>
                          </div>
                          <div className="flex gap-2.5 rounded-2xl bg-secondary p-3">
                            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p className="text-xs leading-relaxed"><span className="font-semibold">Tu entrenador:</span> <span className="text-muted-foreground">sube 2 kg en la sentadilla si ayer te sobraron repeticiones.</span></p>
                          </div>
                        </div>
                      )}

                      {view === "training" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Lunes · Semana 3 de 12</p>
                          <div className="mt-1 flex items-end justify-between">
                            <h4 className="font-display text-lg font-bold leading-tight">Fuerza cuerpo completo</h4>
                            <p role="status" className="text-xs font-semibold">{completed.length} de {exercises.length}</p>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>

                          <div className="mt-4 space-y-2">
                            {exercises.map(({ name, sets, load, last }) => {
                              const done = completed.includes(name);
                              return (
                                <button key={name} type="button" aria-pressed={done} aria-label={`${done ? "Desmarcar" : "Completar"} ${name}`}
                                  onClick={() => setCompleted(c => done ? c.filter(i => i !== name) : [...c, name])}
                                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${done ? "border-primary/40 bg-primary/5" : "border-border hover:bg-secondary"}`}>
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary"><Dumbbell className="h-5 w-5 text-muted-foreground" /></span>
                                  <span className="min-w-0 flex-1">
                                    <span className={`block truncate text-sm font-semibold ${done ? "line-through opacity-60" : ""}`}>{name}</span>
                                    <span className="block text-xs text-muted-foreground">{sets} · {load}</span>
                                    <span className="block text-[10px] text-muted-foreground/80">{last}</span>
                                  </span>
                                  <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{done && <Check className="h-4 w-4" />}</span>
                                </button>
                              );
                            })}
                          </div>

                          {completed.length > 0 && completed.length < exercises.length && (
                            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-primary/10 p-3 text-xs"><Timer className="h-4 w-4 text-primary" /><span className="font-semibold">Descanso 1:30</span><span className="text-muted-foreground">· siguiente ejercicio</span></div>
                          )}
                          {completed.length === exercises.length && (
                            <div className="mt-3 rounded-2xl bg-primary/10 p-3 text-center text-xs font-semibold">Sesión completada · tu entrenador la verá</div>
                          )}
                          <div className="mt-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => setCompleted([])}><RotateCcw className="h-3.5 w-3.5" /> Reiniciar demo</Button>
                          </div>
                        </div>
                      )}

                      {view === "nutrition" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Hoy · plan Completo</p>
                          <div className="mt-3 flex items-center gap-4 rounded-2xl bg-secondary p-4">
                            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-border" strokeWidth="3.5" />
                              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-primary" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="38" />
                            </svg>
                            <div><p className="font-display text-2xl font-bold">1.420</p><p className="text-xs text-muted-foreground">de 2.300 kcal</p></div>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {[["Proteína", 96, 150], ["Carbos", 150, 240], ["Grasas", 45, 75]].map(([l, v, t]) => (
                              <div key={l as string} className="rounded-xl border border-border p-2.5">
                                <p className="text-[10px] text-muted-foreground">{l}</p>
                                <p className="text-sm font-semibold">{v}<span className="text-[10px] font-normal text-muted-foreground">/{t} g</span></p>
                                <div className="mt-1.5 h-1 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${((v as number) / (t as number)) * 100}%` }} /></div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 divide-y divide-border rounded-2xl border border-border">
                            {[["Desayuno", "Yogur, avena y fruta", true], ["Comida", "Arroz, pollo y verduras", true], ["Cena", "Tortilla, patata y ensalada", false]].map(([m, t, d]) => (
                              <div key={m as string} className="flex items-center justify-between gap-2 p-3">
                                <div><p className="text-sm font-semibold">{m}</p><p className="text-xs text-muted-foreground">{t}</p></div>
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${d ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{d && <Check className="h-3 w-3" />}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-[10px] text-muted-foreground">Comidas ilustrativas, sin recomendaciones para tu caso.</p>
                        </div>
                      )}

                      {view === "chat" && (
                        <div className="flex h-full flex-col">
                          <div className="flex items-center gap-2.5 border-b border-border pb-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">N</span>
                            <div>
                              <p className="text-sm font-semibold">Niko · tu entrenador</p>
                              <p className="text-[10px] text-muted-foreground">Responde normalmente en el día</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2.5">
                            {chatMessages.map((m, i) => (
                              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary"}`}>
                                  <p>{m.text}</p>
                                  <p className={`mt-0.5 text-right text-[9px] ${m.from === "me" ? "opacity-70" : "text-muted-foreground"}`}>{m.time}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1.5 pl-4 pr-1.5">
                            <span className="flex-1 text-xs text-muted-foreground">Escribe a tu entrenador…</span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Send className="h-3.5 w-3.5" /></span>
                          </div>
                          <p className="mt-3 text-[10px] text-muted-foreground">Conversación de ejemplo; en la app real hablas con tu entrenador.</p>
                        </div>
                      )}

                      {view === "progress" && (
                        <div>
                          <p className="text-[11px] font-medium text-primary">Últimas 8 semanas</p>
                          <div className="mt-3 rounded-2xl bg-secondary p-4">
                            <div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Peso corporal</p><p className="font-display text-2xl font-bold">80,6 kg</p></div><p className="text-xs font-semibold text-primary">−1,8 kg</p></div>
                            <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="mt-3 h-20 w-full"><polyline points={path} fill="none" className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
                          </div>
                          <div className="mt-3 rounded-2xl border border-border p-4">
                            <p className="text-xs text-muted-foreground">Sesiones esta semana</p>
                            <div className="mt-2 flex gap-1.5">{["L", "M", "X", "J", "V", "S", "D"].map((d, i) => <span key={d} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-[10px] font-semibold ${[0, 2].includes(i) ? "bg-primary text-primary-foreground" : i === 4 ? "border border-dashed border-primary" : "bg-secondary text-muted-foreground"}`}>{d}</span>)}</div>
                            <p className="mt-2 text-xs"><span className="font-semibold">2 de 3</span> <span className="text-muted-foreground">· próxima el viernes</span></p>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-border p-3"><p className="text-[10px] text-muted-foreground">Sentadilla</p><p className="text-sm font-semibold">14 → 20 kg</p></div>
                            <div className="rounded-xl border border-border p-3"><p className="text-[10px] text-muted-foreground">Cintura</p><p className="text-sm font-semibold">−3 cm</p></div>
                          </div>
                          <p className="mt-3 text-[10px] text-muted-foreground">Los datos de esta demo no representan resultados de un cliente.</p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* floating tab bar (same 5 tabs as the real app) */}
                <nav className="absolute inset-x-3 bottom-5 rounded-full border border-border bg-background/85 px-1.5 py-1.5 shadow-lg backdrop-blur-xl" role="group" aria-label="Secciones de la demo">
                  <div className="grid grid-cols-5">
                    {views.map(({ key, label, icon: Icon }) => {
                      const active = view === key;
                      return (
                        <button key={key} type="button" aria-pressed={active} onClick={() => changeView(key)}
                          className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full text-[9px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                          {active && <motion.span layoutId="demo-tab" className="absolute inset-0 rounded-full bg-primary/10" transition={{ type: "spring", bounce: 0.25, duration: 0.5 }} />}
                          <Icon className="relative h-5 w-5" />
                          <span className="relative">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </nav>

                {/* home indicator */}
                <span aria-hidden className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-foreground/30" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {onFree && <Button variant="hero" onClick={onFree}>Crear cuenta gratis y guardar mi progreso <ArrowRight className="h-4 w-4" /></Button>}
          <Button variant="outline" onClick={onPlans}>Ver qué incluye cada plan</Button>
        </div>
      </div>
    </section>
  );
}
