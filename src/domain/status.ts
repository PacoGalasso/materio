import { DomainError } from "./errors";

export const WEIGHING_STATUSES = ["open", "completed", "cancelled"] as const;
export type WeighingStatus = (typeof WEIGHING_STATUSES)[number];

const TRANSITIONS: Record<WeighingStatus, readonly WeighingStatus[]> = {
  open: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: WeighingStatus, to: WeighingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: WeighingStatus, to: WeighingStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError("INVALID_STATUS_TRANSITION", { message: `${from} → ${to}` });
  }
}

/** Whether a ticket in this status can still be edited (weights, price, notes…). */
export function isEditable(status: WeighingStatus): boolean {
  return status === "open";
}
