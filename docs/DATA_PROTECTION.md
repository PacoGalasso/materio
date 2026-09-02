# Data Protection

Describes what personal data MATIÈRE handles and how, to inform (not replace) a proper legal
review before processing real customer data. **This is not a legal compliance document and
does not claim certification against LPD (Swiss Federal Act on Data Protection), GDPR, or
any other framework.** Legal validation by a qualified party remains necessary before
onboarding real customer data, and this document should be reviewed alongside that process,
not instead of it.

## Categories of personal data handled

| Category | Examples | Where |
| --- | --- | --- |
| Account credentials | Email, name, password hash | `user`, `account` tables |
| Session data | Session tokens, IP address, user agent | `session` table |
| Business contacts | Supplier contact name, phone, email | `suppliers` table |
| Operational metadata | Who performed an action, when | `audit_events.actor_user_id` |

Vehicle plates (`weighing_tickets.plate_snapshot`, `vehicles`) are arguably personal data in
some jurisdictions when traceable to an individual (as opposed to a company fleet vehicle) —
flagged here for the legal review rather than assumed either way.

No payment card data, government ID numbers, health data, or other special-category data is
collected or processed anywhere in this application.

## Purpose

- **Credentials/session data**: authenticating staff who operate the weighbridge software.
- **Supplier contact details**: operational necessity — contacting a supplier about a
  delivery, a price, or an issue is core to running a scrap yard.
- **Audit trail actor identity**: accountability for business-critical actions (who
  completed a ticket, who changed a price) — both an operational control and, in most
  jurisdictions, a reasonable and expected practice for financial/operational record-keeping.

## Data minimization

- No data is collected that isn't used by a feature. There is no analytics/tracking
  integration, no third-party script, no data shared with any external service.
- Form field length limits (`src/server/validation/*.ts`) bound how much text can be stored
  per field, incidentally limiting how much incidental personal data (e.g. someone pasting
  an email signature into a notes field) can accumulate.
- Session data (`ip_address`, `user_agent` on the `session` table) is Better Auth's default
  schema, used for session management/security purposes, not surfaced in any UI or report.

## Retention

No automatic data retention/deletion policy is implemented in this phase. Recommendations
for the legal review to weigh in on:

- **Business records** (tickets, movements, prices): scrap-metal/recycling operations are
  often subject to statutory record-keeping requirements (varies by canton/jurisdiction) —
  do not implement automatic deletion of business records without confirming the applicable
  retention requirement first.
- **Session data**: sessions already expire (14-day sliding window, `src/server/auth.ts`);
  expired session rows are not currently purged automatically — a scheduled cleanup job
  would be a reasonable, low-risk addition if row growth becomes a concern, since expired
  sessions have no operational value once past their `expires_at`.
- **Audit events**: append-only by design (`src/server/audit.ts`); no deletion path exists
  today. If a retention limit is ever required, it should be a scheduled archival/deletion
  process, not an in-app "delete audit log" feature (which would undermine the trail's
  purpose).

## Deletion / export (data subject rights)

**Not implemented in this phase.** If required (e.g. a supplier contact requests deletion of
their personal data, or a departing employee's account needs full removal), this currently
requires direct database operations by whoever operates the deployment — there is no
self-service or admin-UI flow. Building one is a reasonable next step once real customer
data is in scope, particularly:

- A member-removal flow already exists at the database-relationship level
  (`organizationMemberships` rows can be deleted independently of the underlying `user`
  row), but a full "delete this user's account and personal data" operation, and a
  "export what we hold about a given supplier contact" operation, do not yet exist as
  application features.

## Access control

Covered in depth in `docs/THREAT_MODEL.md`. In summary: every read/write of personal data
goes through the same organization-scoped, role-checked path as any other business data —
there is no separate, weaker access path for personal-data fields specifically. VIEWER role
can read supplier contact details (consistent with "read-only business visibility"); no
role can bypass organization scoping.

## Backups

Backups (see `docs/BACKUP_RESTORE.md`) are a full copy of all personal data described above.
Backup storage must carry access control at least as strict as production database access —
this is stated as a requirement in that document, not yet implemented against any actual
backup infrastructure since none has been provisioned in this phase.

## What this phase did NOT do

- No legal review has been performed.
- No data processing agreement, privacy policy, or user-facing consent flow exists.
- No data subject rights (access/export/deletion) self-service flow exists.
- No specific retention period has been set or enforced for any data category.
