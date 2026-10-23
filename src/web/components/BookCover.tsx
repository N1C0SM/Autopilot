import { useState } from "react";
import { BookOpen } from "lucide-react";

interface Props {
  title: string;
  src?: string | null;
}

const BookCover = ({ title, src }: Props) => {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!src && failed !== src;
  return (
    <div className="relative isolate mx-auto aspect-[3/4] w-full overflow-hidden rounded-r-xl rounded-l-[4px] bg-card">
      {showImage ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary px-4 text-center">
          <BookOpen className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />
          <span className="line-clamp-3 type-subhead font-semibold text-foreground">{title}</span>
        </div>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[4%] bg-black/25" />
    </div>
  );
};

export default BookCover;
