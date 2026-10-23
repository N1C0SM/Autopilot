import type { ComponentType, ReactNode } from "react";

interface Props {
  icon?: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  /** Replaces the icon (e.g. a Spinner while something is loading). */
  mark?: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}

/** Composition of the Welcome screen for purchase and download states: squircle, headline, one line, actions. */
export const ResourcesStatus = ({ icon: Icon, mark, title, description, children }: Props) => (
  <div className="flex w-full max-w-sm flex-col items-center text-center">
    <div className="flex h-20 w-20 items-center justify-center rounded-[22%] bg-card">
      {mark ?? (Icon ? <Icon className="h-9 w-9 text-primary" strokeWidth={1.75} /> : null)}
    </div>
    <h1 className="mt-7 type-title1">{title}</h1>
    {description ? <p className="mt-2 type-body text-muted-foreground">{description}</p> : null}
    {children ? <div className="mt-8 w-full space-y-1">{children}</div> : null}
  </div>
);

export const ResourcesStatusScreen = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-10 pt-safe pb-safe">{children}</div>
);
