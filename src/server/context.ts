/**
 * Organization/session context. Every protected server component, server action and query
 * that needs to know "who is calling, for which organization, with what role" goes through
 * `getOrgContext()` here — never through a client-supplied organizationId or role.
 *
 * `proxy.ts` redirects unauthenticated page loads to /connexion as a UX convenience, but
 * Server Actions are not reliably covered by it (see Next.js's own proxy.md warning), so
 * this module is the actual enforcement boundary and must be called independently by every
 * action, not just every page.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/db/client";
import {
  organizationMemberships,
  organizations,
  yards,
  type MembershipRole,
  type Organization,
  type OrganizationMembership,
  type Yard,
} from "@/db/schema";
import { hasPermission, type Permission } from "@/domain/authorization";
import { auth } from "@/server/auth";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface OrgContext {
  user: SessionUser;
  organization: Organization;
  yard: Yard;
  membership: OrganizationMembership;
}

/** Thrown when a caller has a valid session but no membership in any organization. */
export class NoOrganizationError extends Error {
  constructor() {
    super("Ce compte n'est rattaché à aucune organisation. Contactez votre administrateur.");
    this.name = "NoOrganizationError";
  }
}

/** Thrown when a caller's role does not grant the requested permission. */
export class ForbiddenError extends Error {
  constructor(readonly permission: Permission) {
    super("Vous n'avez pas les droits nécessaires pour cette action.");
    this.name = "ForbiddenError";
  }
}

async function loadOrgContext(): Promise<OrgContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const db = await getDb();
  const [membership] = await db
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.userId, session.user.id))
    .orderBy(asc(organizationMemberships.createdAt))
    .limit(1);
  if (!membership) throw new NoOrganizationError();

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, membership.organizationId))
    .limit(1);
  if (!organization) throw new NoOrganizationError();

  const [yard] =
    await db
      .select()
      .from(yards)
      .where(eq(yards.organizationId, organization.id))
      .orderBy(asc(yards.isDefault), asc(yards.createdAt))
      .limit(1);
  if (!yard) throw new NoOrganizationError();

  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    organization,
    yard,
    membership,
  };
}

/** Request-scoped session/org lookup (React `cache` dedupes calls within one render). */
const loadOrgContextCached = cache(loadOrgContext);

/**
 * Resolves the caller's organization context, redirecting to /connexion if unauthenticated.
 * Call this before any try/catch in a server action (Next.js redirects must propagate, not
 * be caught) — see the existing pattern in src/server/actions/weighing.ts.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const context = await loadOrgContextCached();
  if (!context) redirect("/connexion");
  return context;
}

/** Resolves the org context and asserts the caller's role grants `permission`. */
export async function requireOrgContext(permission: Permission): Promise<OrgContext> {
  const context = await getOrgContext();
  if (!hasPermission(context.membership.role, permission)) {
    throw new ForbiddenError(permission);
  }
  return context;
}

export function roleLabel(role: MembershipRole): string {
  switch (role) {
    case "OWNER":
      return "Propriétaire";
    case "ADMIN":
      return "Administrateur";
    case "OPERATOR":
      return "Opérateur";
    case "VIEWER":
      return "Lecture seule";
  }
}
