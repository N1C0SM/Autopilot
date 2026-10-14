import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The iOS text styles (`type-*`, index.css) set size and leading together, so a later
// `type-*`, `text-[Npx]` or `leading-*` must replace an earlier one instead of both applying.
const TYPE_STYLES = [
  "large-title",
  "title1",
  "title2",
  "title3",
  "headline",
  "body",
  "callout",
  "subhead",
  "footnote",
  "caption1",
  "caption2",
  "group-header",
];

const twMerge = extendTailwindMerge<"type-style">({
  extend: {
    classGroups: { "type-style": [{ type: TYPE_STYLES }] },
    conflictingClassGroups: { "type-style": ["font-size", "leading"], "font-size": ["type-style"] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
