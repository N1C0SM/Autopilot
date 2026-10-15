import { BookOpen } from "lucide-react";

interface Props {
  title: string;
  src?: string | null;
}

const BookCover = ({ title, src }: Props) => (
  <div className="relative isolate mx-auto aspect-[3/4] w-full overflow-hidden rounded-r-xl rounded-l-[4px] bg-card ">
    {src ? (
      <img
        src={src}
        alt={title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
    ) : (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary px-4 text-center">
        <BookOpen className="h-7 w-7 text-primary" strokeWidth={1.75} />
        <span className="line-clamp-3 type-subhead font-semibold text-foreground">{title}</span>
      </div>
    )}
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[6%] bg-gradient-to-r from-black/40 to-transparent" />
  </div>
);

export default BookCover;
