import { KeyboardShortcuts } from "@/components/shell/keyboard-shortcuts";
import { Sidebar } from "@/components/shell/sidebar";
import { getOrgContext, roleLabel } from "@/server/context";

// Every workspace screen reads live operational data: render on each request.
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { organization, yard, user, membership } = await getOrgContext();
  return (
    <div className="min-h-dvh">
      <Sidebar
        organizationName={organization.name}
        yardName={yard.name}
        userName={user.name}
        roleLabel={roleLabel(membership.role)}
      />
      <KeyboardShortcuts />
      <main className="print-full flex min-h-dvh flex-col pt-12 lg:pt-0 lg:pl-56">{children}</main>
    </div>
  );
}
