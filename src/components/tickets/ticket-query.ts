import { WEIGHING_STATUSES, type WeighingStatus } from "@/db/schema";
import { addDays, zonedDate } from "@/lib/time";
import {
  TICKET_SORT_KEYS,
  type TicketListFilters,
  type TicketSortKey,
} from "@/server/queries/tickets";

export type SearchParams = Record<string, string | string[] | undefined>;

export interface TicketPageQuery {
  q: string;
  status: WeighingStatus | "all";
  materialId: string | undefined;
  supplierId: string | undefined;
  from: string | undefined;
  to: string | undefined;
  sort: TicketSortKey;
  dir: "asc" | "desc";
  page: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateStart(value: string | undefined): Date | undefined {
  if (!value || !DATE_RE.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = zonedDate({ year, month, day });
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Normalizes raw search params (French keys) into a typed query object. */
export function parseTicketQuery(searchParams: SearchParams): TicketPageQuery {
  const statusRaw = first(searchParams.statut);
  const sortRaw = first(searchParams.tri);
  const dirRaw = first(searchParams.sens);
  const pageRaw = Number(first(searchParams.page) ?? "1");
  const from = first(searchParams.du);
  const to = first(searchParams.au);
  return {
    q: first(searchParams.q)?.trim() ?? "",
    status: (WEIGHING_STATUSES as readonly string[]).includes(statusRaw ?? "")
      ? (statusRaw as WeighingStatus)
      : "all",
    materialId: first(searchParams.matiere) || undefined,
    supplierId: first(searchParams.fournisseur) || undefined,
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    sort: (TICKET_SORT_KEYS as readonly string[]).includes(sortRaw ?? "")
      ? (sortRaw as TicketSortKey)
      : "date",
    dir: dirRaw === "asc" ? "asc" : "desc",
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
  };
}

export function toListFilters(query: TicketPageQuery): TicketListFilters {
  const toStart = dateStart(query.to);
  return {
    q: query.q || undefined,
    status: query.status,
    materialId: query.materialId,
    supplierId: query.supplierId,
    from: dateStart(query.from),
    to: toStart ? addDays(toStart, 1) : undefined,
    sort: query.sort,
    dir: query.dir,
    page: query.page,
    pageSize: 25,
  };
}

/** Rebuilds the URLSearchParams matching a query (only non-default values). */
export function toSearchParams(query: TicketPageQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "all") params.set("statut", query.status);
  if (query.materialId) params.set("matiere", query.materialId);
  if (query.supplierId) params.set("fournisseur", query.supplierId);
  if (query.from) params.set("du", query.from);
  if (query.to) params.set("au", query.to);
  if (query.sort !== "date") params.set("tri", query.sort);
  if (query.dir !== "desc") params.set("sens", query.dir);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function hasActiveFilters(query: TicketPageQuery): boolean {
  return Boolean(
    query.q ||
    query.status !== "all" ||
    query.materialId ||
    query.supplierId ||
    query.from ||
    query.to,
  );
}
