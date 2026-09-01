"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { controlClasses, fieldMessageId } from "./field";

export interface ComboboxOption {
  id: string;
  label: string;
  description?: string;
  /** Extra searchable text (codes, aliases). */
  keywords?: string;
}

interface ComboboxProps {
  id: string;
  /** Name of the hidden input carrying the selected id in the form submission. */
  name: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (id: string | null, option: ComboboxOption | null) => void;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  /** When provided, a "create" row is offered for queries with no exact match. */
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
  maxResults?: number;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Accessible searchable select (WAI-ARIA combobox with listbox popup).
 * Typing filters; arrows move; Enter selects; Escape closes; the selected id is submitted
 * through a hidden input so the surrounding form stays a plain HTML form.
 */
export function Combobox({
  id,
  name,
  options,
  value,
  onChange,
  placeholder,
  invalid,
  autoFocus,
  disabled,
  emptyMessage = "Aucun résultat",
  onCreate,
  createLabel = (query) => `Créer « ${query} »`,
  maxResults = 50,
}: ComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Keep the visible text in sync when the selection changes from outside (e.g. after creation).
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setQuery(selected?.label ?? "");
  }

  const filtered = useMemo(() => {
    const q = normalize(query);
    const isSelectedLabel = selected && q === normalize(selected.label);
    const list =
      q.length === 0 || isSelectedLabel
        ? options
        : options.filter((option) =>
            normalize(
              `${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`,
            ).includes(q),
          );
    return list.slice(0, maxResults);
  }, [options, query, selected, maxResults]);

  const trimmedQuery = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    trimmedQuery.length >= 2 &&
    !options.some((option) => normalize(option.label) === normalize(trimmedQuery));
  const rowCount = filtered.length + (canCreate ? 1 : 0);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  const select = useCallback(
    (option: ComboboxOption | null) => {
      onChange(option?.id ?? null, option);
      setQuery(option?.label ?? "");
      close();
    },
    [onChange, close],
  );

  const commitCreate = useCallback(() => {
    if (!onCreate || !canCreate) return;
    close();
    onCreate(trimmedQuery);
  }, [onCreate, canCreate, close, trimmedQuery]);

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (containerRef.current?.contains(event.relatedTarget as Node | null)) return;
    close();
    // Restore or clear: never leave a label that does not match the submitted id.
    if (trimmedQuery.length === 0) {
      if (value !== null) onChange(null, null);
      setQuery("");
    } else if (!selected || normalize(trimmedQuery) !== normalize(selected.label)) {
      const exact = options.find((option) => normalize(option.label) === normalize(trimmedQuery));
      if (exact) select(exact);
      else setQuery(selected?.label ?? "");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActiveIndex((index) => (rowCount === 0 ? 0 : (index + 1) % rowCount));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActiveIndex((index) => (rowCount === 0 ? 0 : (index - 1 + rowCount) % rowCount));
        break;
      case "Enter":
        if (!open) return;
        event.preventDefault();
        if (activeIndex < filtered.length) select(filtered[activeIndex] ?? null);
        else commitCreate();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
          setQuery(selected?.label ?? "");
        }
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;
  const activeId = open && rowCount > 0 ? optionId(Math.min(activeIndex, rowCount - 1)) : undefined;

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <input type="hidden" name={name} value={value ?? ""} />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        aria-describedby={fieldMessageId(id)}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        className={cn(controlClasses, "pr-8")}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Afficher les options"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen((state) => !state);
          inputRef.current?.focus();
        }}
        className="text-ink-muted hover:text-ink absolute inset-y-0 right-0 flex w-8 items-center justify-center"
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>
      <ul
        id={listId}
        role="listbox"
        hidden={!open}
        className="bg-surface shadow-popover absolute top-full left-0 z-30 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-sm py-1"
      >
        {filtered.map((option, index) => {
          const active = index === activeIndex;
          const isSelected = option.id === value;
          return (
            <li
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(option)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm",
                active && "bg-accent-soft text-accent-text",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.description ? (
                  <span className="text-ink-muted block truncate text-xs">
                    {option.description}
                  </span>
                ) : null}
              </span>
              {isSelected ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
            </li>
          );
        })}
        {canCreate ? (
          <li
            id={optionId(filtered.length)}
            role="option"
            aria-selected={false}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(filtered.length)}
            onClick={commitCreate}
            className={cn(
              "border-line-soft flex cursor-pointer items-center gap-2 border-t px-2.5 py-1.5 text-sm font-medium",
              activeIndex === filtered.length && "bg-accent-soft text-accent-text",
            )}
          >
            <Plus className="size-3.5" aria-hidden />
            {createLabel(trimmedQuery)}
          </li>
        ) : null}
        {rowCount === 0 ? (
          <li className="text-ink-muted px-2.5 py-1.5 text-sm">{emptyMessage}</li>
        ) : null}
      </ul>
    </div>
  );
}
