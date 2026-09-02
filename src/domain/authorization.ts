/**
 * Centralized authorization policy: pure functions from role → permission, no DB/React.
 * Every protected server operation must go through here rather than checking
 * `role === "..."` inline — see src/server/context.ts for how a role is resolved from a
 * session, and every file under src/server/actions for how it's enforced.
 */
import type { MembershipRole } from "@/db/schema";

const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

/** True when `role` is at least as privileged as `minimum` (OWNER > ADMIN > OPERATOR > VIEWER). */
export function roleAtLeast(role: MembershipRole, minimum: MembershipRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Named permissions, one per kind of protected operation. Keeping this as an explicit map
 * (rather than scattering `roleAtLeast(role, "OPERATOR")` calls inline) means the whole
 * authorization surface of the app can be read and audited in one place.
 */
export const PERMISSIONS = {
  // Weighing / stock: day-to-day yard operations.
  OPERATE_WEIGHING: "OPERATOR",
  MANAGE_INVENTORY: "OPERATOR",
  MANAGE_SUPPLIERS: "OPERATOR",
  // Materials/pricing and org settings: less frequent, higher-impact changes.
  MANAGE_MATERIALS: "ADMIN",
  MANAGE_ORGANIZATION_SETTINGS: "ADMIN",
  // Membership/role administration: ownership-adjacent, kept separate from MANAGE_ORGANIZATION_SETTINGS.
  MANAGE_MEMBERS: "ADMIN",
  CHANGE_OWNER_ROLE: "OWNER",
  VIEW_AUDIT_LOG: "ADMIN",
  // Development/demo-only tooling; also gated by NODE_ENV at the call site.
  RESET_DEMO_DATA: "OWNER",
} as const satisfies Record<string, MembershipRole>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSIONS[permission]);
}
