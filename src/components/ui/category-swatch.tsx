import type { MaterialCategory } from "@/db/schema";
import { cn } from "@/lib/cn";
import { CATEGORY_LABELS } from "@/lib/labels";

const SWATCH: Record<MaterialCategory, string> = {
  non_ferrous: "bg-cat-non-ferrous",
  ferrous: "bg-cat-ferrous",
  stainless: "bg-cat-stainless",
  cables: "bg-cat-cables",
  other: "bg-cat-other",
};

/** Small colour mark identifying a material family; always paired with text. */
export function CategorySwatch({
  category,
  className,
}: {
  category: MaterialCategory;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-xs", SWATCH[category], className)}
      role="img"
      aria-label={CATEGORY_LABELS[category]}
    />
  );
}

export function MaterialName({
  name,
  category,
  className,
}: {
  name: string;
  category: MaterialCategory;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CategorySwatch category={category} />
      <span>{name}</span>
    </span>
  );
}
