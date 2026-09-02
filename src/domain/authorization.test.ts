import { describe, expect, it } from "vitest";

import { MEMBERSHIP_ROLES, type MembershipRole } from "@/db/schema";

import { hasPermission, PERMISSIONS, roleAtLeast, type Permission } from "./authorization";

describe("roleAtLeast", () => {
  it("orders roles OWNER > ADMIN > OPERATOR > VIEWER", () => {
    expect(roleAtLeast("OWNER", "VIEWER")).toBe(true);
    expect(roleAtLeast("OWNER", "OWNER")).toBe(true);
    expect(roleAtLeast("ADMIN", "OPERATOR")).toBe(true);
    expect(roleAtLeast("OPERATOR", "ADMIN")).toBe(false);
    expect(roleAtLeast("VIEWER", "OPERATOR")).toBe(false);
    expect(roleAtLeast("VIEWER", "VIEWER")).toBe(true);
  });
});

describe("hasPermission", () => {
  it("VIEWER holds no permission (every permission requires at least OPERATOR)", () => {
    for (const permission of Object.keys(PERMISSIONS) as Permission[]) {
      expect(hasPermission("VIEWER", permission)).toBe(false);
    }
  });

  it("OPERATOR can operate weighing, inventory and suppliers but not manage materials or members", () => {
    expect(hasPermission("OPERATOR", "OPERATE_WEIGHING")).toBe(true);
    expect(hasPermission("OPERATOR", "MANAGE_INVENTORY")).toBe(true);
    expect(hasPermission("OPERATOR", "MANAGE_SUPPLIERS")).toBe(true);
    expect(hasPermission("OPERATOR", "MANAGE_MATERIALS")).toBe(false);
    expect(hasPermission("OPERATOR", "MANAGE_MEMBERS")).toBe(false);
    expect(hasPermission("OPERATOR", "MANAGE_ORGANIZATION_SETTINGS")).toBe(false);
    expect(hasPermission("OPERATOR", "RESET_DEMO_DATA")).toBe(false);
  });

  it("ADMIN can manage materials, settings and members but not change an OWNER's role or reset demo data", () => {
    expect(hasPermission("ADMIN", "MANAGE_MATERIALS")).toBe(true);
    expect(hasPermission("ADMIN", "MANAGE_ORGANIZATION_SETTINGS")).toBe(true);
    expect(hasPermission("ADMIN", "MANAGE_MEMBERS")).toBe(true);
    expect(hasPermission("ADMIN", "VIEW_AUDIT_LOG")).toBe(true);
    expect(hasPermission("ADMIN", "CHANGE_OWNER_ROLE")).toBe(false);
    expect(hasPermission("ADMIN", "RESET_DEMO_DATA")).toBe(false);
  });

  it("only OWNER holds ownership-sensitive permissions", () => {
    expect(hasPermission("OWNER", "CHANGE_OWNER_ROLE")).toBe(true);
    expect(hasPermission("OWNER", "RESET_DEMO_DATA")).toBe(true);
    for (const role of MEMBERSHIP_ROLES.filter((r): r is MembershipRole => r !== "OWNER")) {
      expect(hasPermission(role, "CHANGE_OWNER_ROLE")).toBe(false);
      expect(hasPermission(role, "RESET_DEMO_DATA")).toBe(false);
    }
  });

  it("every permission maps to a real membership role", () => {
    for (const permission of Object.keys(PERMISSIONS) as Permission[]) {
      expect(MEMBERSHIP_ROLES).toContain(PERMISSIONS[permission]);
    }
  });
});
