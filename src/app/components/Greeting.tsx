import { motion } from "framer-motion";
import { Sun, Moon, Sunrise, Sunset } from "lucide-react";

interface Props {
  name: string;
  createdAt?: string;
  completedDays?: number;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 7) return { text: "Buenas noches", icon: Moon };
  if (hour < 12) return { text: "Buenos días", icon: Sunrise };
  if (hour < 19) return { text: "Buenas tardes", icon: Sun };
  return { text: "Buenas noches", icon: Sunset };
};

const getContextualPhrase = (createdAt?: string, completedDays?: number) => {
  if (!createdAt) {
    const fallback = [
      "¡Hoy es un gran día para entrenar! 💪",
      "Cada día cuenta. ¡Tú puedes!",
      "La constancia es la clave del éxito.",
      "Un paso más cerca de tu objetivo.",
      "Tu mejor versión te espera.",
    ];
    return fallback[new Date().getDay() % fallback.length];
  }

  const weeksActive = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 7)
  );

  if (weeksActive < 1) return "¡Bienvenido/a! Tu plan te espera. 🚀";
  if (weeksActive === 1) return "Primera semana completada. ¡Sigue así! 🔥";

  if (completedDays && completedDays > 0) {
    if (completedDays >= 20) return `${completedDays} días completados. ¡Eres imparable! 🏆`;
    if (completedDays >= 10) return `${completedDays} días completados. La constancia se nota. 💪`;
    return `${completedDays} días completados. ¡Cada uno cuenta! ✨`;
  }

  if (weeksActive >= 4) return `Llevas ${weeksActive} semanas con tu plan. ¿Alguna duda? Escríbeme por el chat. 💬`;
  return `Semana ${weeksActive + 1} de tu plan. ¡Sigue con todo! 🔥`;
};

const Greeting = ({ name, createdAt, completedDays }: Props) => {
  const { text, icon: Icon } = getGreeting();
  const phrase = getContextualPhrase(createdAt, completedDays);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold font-display">
          {text}, <span className="text-gradient">{name || "campeón"}</span>
        </h1>
      </div>
      <p className="text-sm text-muted-foreground ml-7">{phrase}</p>
    </motion.div>
  );
};

export default Greeting;
