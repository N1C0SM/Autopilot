import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { UserCircle2 } from "lucide-react";

interface Trainer {
  trainer_id: string;
  name: string;
  email: string;
  photo_url: string | null;
  headline: string | null;
}

const MyTrainerCard = () => {
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.rpc as any)("get_my_trainer");
      if (data && data.length > 0) setTrainer(data[0] as Trainer);
      setLoaded(true);
    })();
  }, []);

  if (!loaded || !trainer) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4"
    >
      {trainer.photo_url ? (
        <img src={trainer.photo_url} alt={trainer.name} className="w-12 h-12 rounded-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
          <UserCircle2 className="w-7 h-7 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Tu entrenador</p>
        <p className="font-display font-bold text-base truncate">{trainer.name}</p>
        {trainer.headline && (
          <p className="text-xs text-muted-foreground truncate">{trainer.headline}</p>
        )}
      </div>
    </motion.div>
  );
};

export default MyTrainerCard;