import { BookOpen } from "lucide-react";

interface Props {
  title: string;
  src?: string | null;
}

const BookCover = ({ title, src }: Props) => (
  <div className="relative isolate mx-auto aspect-[3/4] w-full overflow-hidden rounded-r-lg rounded-l-[3px] bg-gradient-to-br from-primary/20 via-secondary to-background shadow-[0_12px_24px_-10px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
    {src ? (
      <img
        src={src}
        alt={title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    ) : (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary/20 via-secondary to-background px-6 text-center">
        <BookOpen className="h-8 w-8 text-primary/70" />
        <span className="line-clamp-4 font-display text-lg font-bold leading-tight text-foreground">{title}</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Autopilot</span>
      </div>
    )}
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/45 via-white/10 to-black/10" />
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-[7%] w-px bg-white/25" />
  </div>
);

export default BookCover;
