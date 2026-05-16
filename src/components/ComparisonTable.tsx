import { motion } from "framer-motion";
import { Check, X, Minus } from "lucide-react";

type Row = { label: string; apps: boolean | string; coach: boolean | string; autopilot: boolean | string };

const ROWS: Row[] = [
  { label: "Diagnóstico personalizado", apps: false, coach: true, autopilot: true },
  { label: "Plan adaptado a tu nivel", apps: "Plantillas", coach: true, autopilot: true },
  { label: "Persona real detrás", apps: false, coach: true, autopilot: true },
  { label: "Ajustes según tu semana", apps: false, coach: "Limitado", autopilot: true },
  { label: "Encaje en tus horarios", apps: true, coach: false, autopilot: true },
  { label: "Coste mensual", apps: "10–20€", coach: "200–500€", autopilot: "desde 29€" },
];

const Cell = ({ value }: { value: Row["apps"] }) => {
  if (value === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
};

const ComparisonTable = () => {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-3">
            Comparación honesta
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">
            Menos que un entrenador presencial.{" "}
            <span className="text-gradient">Más personalizado que una app.</span>
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card/60 border border-border rounded-3xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 border-b border-border">
                <tr>
                  <th className="text-left text-[11px] uppercase tracking-widest text-muted-foreground font-semibold py-4 px-5">
                    &nbsp;
                  </th>
                  <th className="text-center text-[11px] uppercase tracking-widest text-muted-foreground font-semibold py-4 px-3">
                    Apps fitness
                  </th>
                  <th className="text-center text-[11px] uppercase tracking-widest text-muted-foreground font-semibold py-4 px-3">
                    Entrenador presencial
                  </th>
                  <th className="text-center text-[11px] uppercase tracking-widest text-primary font-bold py-4 px-3 bg-primary/[0.06]">
                    Autopilot
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr
                    key={r.label}
                    className={`border-b border-border/60 last:border-b-0 ${
                      i % 2 === 1 ? "bg-background/20" : ""
                    }`}
                  >
                    <td className="text-left text-sm font-medium py-3.5 px-5">{r.label}</td>
                    <td className="text-center py-3.5 px-3"><Cell value={r.apps} /></td>
                    <td className="text-center py-3.5 px-3"><Cell value={r.coach} /></td>
                    <td className="text-center py-3.5 px-3 bg-primary/[0.04]"><Cell value={r.autopilot} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ComparisonTable;
