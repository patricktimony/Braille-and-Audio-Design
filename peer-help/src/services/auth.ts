// Authentication boundary.
//
// The prototype has NO sign-in. It uses one local profile kept in this browser,
// and says so on every page. This is not authentication and must not be
// deployed as if it were. A real implementation (see docs/architecture.md)
// would implement AuthService with passkeys or email links on a server.

import type { Person } from "../types";
import { repository } from "./repository";

export interface AuthService {
  /** "demo" means there is no real account: data lives only in this browser. */
  readonly mode: "demo" | "authenticated";
  currentPerson(): Person;
}

export class DemoAuthService implements AuthService {
  readonly mode = "demo" as const;
  currentPerson(): Person {
    return repository.getMe();
  }
}

export const auth: AuthService = new DemoAuthService();
