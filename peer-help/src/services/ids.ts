/** Random, unguessable identifier (used for record ids and call room names). */
export function newId(prefix = ""): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
  return prefix ? `${prefix}-${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}
