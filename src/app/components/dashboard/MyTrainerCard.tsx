import { useEffect, useState } from "react";
import { supabase } from "@/shared/integrations/supabase/client";
import { motion } from "framer-motion";
import { UserCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface Trainer {
  trainer_id: string;
  name: string;
  email: string;
  photo_url: string | null;
  headline: string | null;
}

const MyTrainerCard = ({ onOpenChat }: { onOpenChat?: () => void }) => {
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_my_trainer");
      if (data && data.length > 0) setTrainer(data[0] as Trainer);
      setLoaded(true);
    })();
  }, []);

  if (!loaded || !trainer) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-media p-4 flex items-center gap-4 flex-wrap"
    >
      {trainer.photo_url ? (
        <img loading="lazy" decoding="async" src={trainer.photo_url} alt={trainer.name} className="w-12 h-12 rounded-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
          <UserCircle2 className="w-7 h-7 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-[10rem]">
        <p className="type-caption2 uppercase tracking-widest text-muted-foreground font-medium">Tu entrenador</p>
        <p className="font-display font-bold type-body truncate">{trainer.name}</p>
        <p className="type-footnote text-muted-foreground">
          {trainer.headline || "Es quien prepara y ajusta tu entrenamiento y tu nutrición."}
        </p>
      </div>
      {onOpenChat && (
        <Button size="sm" variant="outline" onClick={onOpenChat} className="shrink-0">
          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Escribirle
        </Button>
      )}
    </motion.div>
  );
};

export default MyTrainerCard;
