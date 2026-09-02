/**
 * Operator-run provisioning script: creates a user with an email/password credential and
 * attaches them to an organization with a role. There is no self-service sign-up (see
 * src/server/auth.ts, emailAndPassword.disableSignUp) — this is the only way to provision
 * an account, run by whoever operates the deployment, not exposed to the app's HTTP surface.
 *
 * Usage:
 *   npm run db:create-user -- --email=owner@example.com --password=... --name="Jane Doe" --role=OWNER [--org=<organizationId>]
 *
 * With no --org, the (single, demo/pilot) organization is used automatically if there is
 * exactly one; otherwise --org is required.
 */
import { randomUUID } from "node:crypto";

import { createLocalAccountIssuer } from "better-auth/db";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { MEMBERSHIP_ROLES, type MembershipRole } from "@/db/schema";

import { account, organizationMemberships, organizations, user } from "./schema";
import { createDatabase } from "./client";

interface Args {
  email: string;
  password: string;
  name: string;
  role: MembershipRole;
  organizationId?: string;
}

function parseArgs(argv: string[]): Args {
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z]+)=(.*)$/.exec(arg);
    if (match?.[1] && match[2] !== undefined) flags[match[1]] = match[2];
  }
  const email = flags.email?.trim().toLowerCase();
  const password = flags.password;
  const name = flags.name?.trim();
  const role = flags.role?.trim().toUpperCase();
  if (!email || !email.includes("@")) throw new Error("--email=<email> is required");
  if (!password || password.length < 12)
    throw new Error("--password=<password> is required (12+ characters)");
  if (!name) throw new Error('--name="Full Name" is required');
  if (!role || !MEMBERSHIP_ROLES.includes(role as MembershipRole)) {
    throw new Error(`--role must be one of ${MEMBERSHIP_ROLES.join(", ")}`);
  }
  return { email, password, name, role: role as MembershipRole, organizationId: flags.org };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { db, pool } = createDatabase();
  try {
    let organizationId = args.organizationId;
    if (!organizationId) {
      const rows = await db.select({ id: organizations.id }).from(organizations);
      if (rows.length === 0) {
        throw new Error("No organization exists yet. Run `npm run db:seed` first, or pass --org.");
      }
      if (rows.length > 1) {
        throw new Error(
          `Multiple organizations exist; pass --org=<id> to choose one (${rows.map((r) => r.id).join(", ")}).`,
        );
      }
      organizationId = rows[0]?.id;
    }
    const [organization] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId!))
      .limit(1);
    if (!organization) throw new Error(`Organization ${organizationId} not found.`);

    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, args.email));
    if (existing) throw new Error(`A user with email ${args.email} already exists.`);

    const passwordHash = await hashPassword(args.password);
    const userId = randomUUID();
    await db.insert(user).values({
      id: userId,
      name: args.name,
      email: args.email,
      emailVerified: true,
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      issuer: createLocalAccountIssuer("credential"),
      userId,
      password: passwordHash,
    });
    await db.insert(organizationMemberships).values({
      id: randomUUID(),
      organizationId: organization.id,
      userId,
      role: args.role,
    });

    console.log(`Created ${args.email} (${args.role}) on "${organization.name}".`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
