import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-start pt-1 pl-1 relative items-center h-9",
        caption_label: "type-headline first-letter:uppercase",
        nav: "flex items-center gap-1",
        nav_button: "inline-flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors active:bg-accent disabled:opacity-30",
        nav_button_previous: "absolute right-10",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "w-10 type-caption1 font-semibold text-muted-foreground",
        row: "flex w-full mt-1",
        cell: "h-10 w-10 p-0 text-center relative focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-middle)]:bg-primary/15 [&:has([aria-selected].day-range-start)]:rounded-l-full [&:has([aria-selected].day-range-end)]:rounded-r-full",
        day: "inline-flex h-10 w-10 items-center justify-center rounded-full type-body tabular-nums transition-colors active:bg-accent aria-selected:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: "bg-primary font-semibold text-primary-foreground active:bg-primary focus:bg-primary focus:text-primary-foreground",
        day_today: "font-semibold text-primary aria-selected:text-primary-foreground",
        day_outside: "day-outside text-muted-foreground opacity-40 aria-selected:bg-transparent aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-30",
        day_range_middle: "day-range-middle aria-selected:bg-transparent aria-selected:font-normal aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-5 w-5" strokeWidth={2.5} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
