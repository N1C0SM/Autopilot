import jsPDF from "jspdf";
import type { DayPlan } from "@/shared/types/training";

interface Macros { protein: number; carbs: number; fats: number }
interface Meal { name: string; description: string }

interface ExportArgs {
  userName: string;
  dayPlans: DayPlan[];
  macros: Macros | null;
  meals: Meal[];
}

// Premium-looking PDF export of training + nutrition plan
export function exportPlanPDF({ userName, dayPlans, macros, meals }: ExportArgs) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48; // margin
  let y = M;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  const sectionTitle = (text: string) => {
    ensureSpace(40);
    doc.setFillColor(15, 15, 20);
    doc.rect(M, y - 14, pageW - M * 2, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text.toUpperCase(), M + 12, y + 4);
    y += 28;
    doc.setTextColor(20, 20, 20);
  };

  // ===== HEADER =====
  doc.setFillColor(20, 20, 28);
  doc.rect(0, 0, pageW, 110, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("AUTOPILOT", M, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 200);
  doc.text("Tu plan personalizado de entrenamiento y nutrición", M, 75);
  doc.setFontSize(9);
  const today = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  doc.text(`${userName ? userName + " · " : ""}${today}`, M, 92);

  y = 140;
  doc.setTextColor(20, 20, 20);

  // ===== TRAINING =====
  sectionTitle("Plan de Entrenamiento");
  y += 8;

  if (!dayPlans || dayPlans.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Sin entrenamiento configurado todavía.", M, y);
    y += 20;
  } else {
    dayPlans.forEach((day, idx) => {
      ensureSpace(36);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 40);
      const dayLabel = day.type === "gimnasio"
        ? `${day.day || ""}${day.routine_name ? " · " + day.routine_name : ""}`
        : `${day.day || ""}${day.sport ? " · " + day.sport : ""}`;
      doc.text(`Día ${idx + 1} · ${dayLabel}`, M, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 70);
      if (day.type === "actividad") {
        ensureSpace(16);
        doc.setFont("helvetica", "italic");
        const desc = [day.intensity, day.duration].filter(Boolean).join(" · ");
        doc.text(desc || "Actividad libre", M + 12, y);
        doc.setFont("helvetica", "normal");
        y += 18;
      } else {
        const exercises = day.exercises || [];
        if (exercises.length === 0) {
          ensureSpace(16);
          doc.setFont("helvetica", "italic");
          doc.text("Día de descanso", M + 12, y);
          doc.setFont("helvetica", "normal");
          y += 18;
        } else {
        exercises.forEach((ex) => {
          ensureSpace(16);
          const detail = [
            ex.series ? `${ex.series} series` : "",
            ex.reps ? `· ${ex.reps} reps` : "",
            ex.weight ? `· ${ex.weight}` : "",
            ex.rest ? `· descanso ${ex.rest}` : "",
          ].filter(Boolean).join(" ");
          doc.setFont("helvetica", "bold");
          doc.text(`• ${ex.name}`, M + 12, y);
          if (detail) {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(110, 110, 120);
            doc.text(detail, M + 24, y + 12);
            doc.setTextColor(60, 60, 70);
            y += 26;
          } else {
            y += 16;
          }
        });
        }
      }
      y += 6;
    });
  }

  // ===== NUTRITION =====
  doc.addPage();
  y = M;
  sectionTitle("Plan de Nutrición");
  y += 8;

  if (macros) {
    const calories = Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fats * 9);
    const cardW = (pageW - M * 2 - 24) / 4;
    const cards = [
      { label: "Calorías", value: `${calories}` },
      { label: "Proteína", value: `${macros.protein}g` },
      { label: "Carbos", value: `${macros.carbs}g` },
      { label: "Grasas", value: `${macros.fats}g` },
    ];
    ensureSpace(80);
    cards.forEach((c, i) => {
      const x = M + i * (cardW + 8);
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(x, y, cardW, 60, 6, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(20, 20, 30);
      doc.text(c.value, x + cardW / 2, y + 28, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 120);
      doc.text(c.label, x + cardW / 2, y + 46, { align: "center" });
    });
    y += 80;
    doc.setTextColor(20, 20, 20);
  }

  if (meals && meals.length > 0) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Comidas del día", M, y);
    y += 18;
    meals.forEach((m) => {
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 40);
      doc.text(m.name, M, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 90);
      const lines = doc.splitTextToSize(m.description || "", pageW - M * 2);
      lines.forEach((line: string) => {
        ensureSpace(14);
        doc.text(line, M, y);
        y += 13;
      });
      y += 8;
    });
  }

  // ===== FOOTER on every page =====
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 170);
    doc.text(`Autopilot · página ${i} de ${pages}`, pageW - M, pageH - 24, { align: "right" });
  }

  const filename = `autopilot-plan-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}