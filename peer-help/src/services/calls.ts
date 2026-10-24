// Live voice calls are handled by an external service in this version.
// The default is Jitsi Meet (free, open source, runs in the browser).
// Set VITE_CALL_BASE_URL at build time to use a self-hosted Jitsi server.

import { newId } from "./ids";

const DEFAULT_BASE = "https://meet.jit.si/";

export function callServiceName(): string {
  return "Jitsi Meet";
}

export function newCallUrl(): string {
  const base = (import.meta.env.VITE_CALL_BASE_URL as string | undefined) || DEFAULT_BASE;
  return `${base.replace(/\/?$/, "/")}PeerHelp-${newId()}`;
}
