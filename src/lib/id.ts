/**
 * Postgres `uuid` columns reject malformed input at the driver level with a raw type error
 * (`invalid input syntax for type uuid`) instead of the app's own "not found" handling. Every
 * lookup that takes an id from outside the process (route params, a server action's bound
 * argument, FormData) must check the shape first so a malformed id behaves exactly like an
 * id that simply doesn't exist — never as a leaked database error.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(value: string): boolean {
  return UUID_RE.test(value);
}
