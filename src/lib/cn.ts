/** Joins class names, skipping falsy values. Small enough to not need a dependency. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
