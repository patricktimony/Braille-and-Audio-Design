# Architecture

## Principle

A blind person should be able to ask for help, find another person, learn something, and remember what they
learned, without navigating a complicated interface. Every design choice below favours that over features.

## Today: a static, multi-page web app

- **Separate HTML pages**, not a single-page app. A normal page load is the most reliable way to get every
  screen reader (VoiceOver, JAWS, NVDA, Narrator) to announce where you are. The shared header and footer are
  inserted at build time by a tiny Vite plugin, so navigation is plain HTML.
- **TypeScript with no UI framework.** It is built by Vite into static files of about 30 KB. It can be
  hosted free on any static host.
- **Accessibility patterns used everywhere:** a skip link; one `h1` per page; labelled controls; hints and
  errors connected with `aria-describedby`; `aria-invalid` with focus moved to the problem; one
  `role="status"` region for announcements (`announce()` in `src/common.ts`); focus moved to the new heading
  when content appears; 44-pixel targets; no drag-and-drop, custom menus, or custom pop-ups (only the
  browser's own `confirm()` for deleting).
- **Security:** user text is only ever inserted with `textContent`, never as HTML. The built pages carry a
  strict Content Security Policy (own scripts only, no third-party code). Record and call-room IDs come from
  `crypto.getRandomValues`.

## Replaceable services (`src/services/`)

Each boundary is an interface with a local, clearly labelled implementation. Pages only call the interface.

| Interface | Prototype implementation | Production replacement |
|---|---|---|
| `AuthService` (`auth.ts`) | `DemoAuthService`: one local profile, **no sign-in** (stated on every page) | Server sessions with passkeys (WebAuthn) and an email magic-link fallback, httpOnly secure cookies, CSRF protection. An open-source identity server such as Keycloak or Ory, or a managed provider. |
| `KeyValueStore` / `Repository` (`storage.ts`, `repository.ts`) | `localStorage`, with a memory fallback | An HTTP API over Postgres or SQLite. The repository methods map one-to-one to endpoints. |
| `MessagingService` (`messaging.ts`) | `SimulatedMessagingService`: scripted demo replies, marked "simulated" | Server-stored messages, delivered by polling first (simplest, and works with every screen reader), then Server-Sent Events. Email or push notification of new messages. |
| `InstructionGenerator` (`instruction-generator.ts`) | `RuleBasedInstructionGenerator`: on-device rules, **not AI** | A server endpoint calling an AI model, either a self-hosted open model or a paid API once funded, with a prompt that turns a transcript into numbered steps. The person still reviews every step before saving. |
| Calls (`calls.ts`) | A link to a new Jitsi Meet room | The same, pointing at a self-hosted Jitsi server (`VITE_CALL_BASE_URL`), or any service that has an accessible web client. |

## Data model (`src/types.ts`)

`Person` (with optional `TrainerProfile`), `Session` (with its `Message`s and call link), `Instruction`
(private or shared, with the time sharing was consented to), and `LibraryEntry`. All are plain JSON, ready to
be stored in database tables of the same shape.

## Consent and privacy rules (to keep when adding a server)

1. Nothing is recorded by the app. Voice calls happen in an external service.
2. A transcript is used only after explicit agreement. In production, **both** people must agree. The
   prototype simulates the demo trainer's agreement and says so.
3. Generated instructions are private by default. Sharing to the library needs a separate, explicit
   choice plus confirmation that there is no personal information. In production, add human moderation
   before anything becomes public.
4. People can see and delete everything stored about them.
5. Trainers show only a first name or nickname.

## Next steps toward a real service (in order)

1. A small API server (for example Node with Hono or Fastify) with Postgres, plus real authentication.
2. Real trainer directory and request/accept flow, plus message delivery.
3. Safety: reporting and blocking, trainer verification for paid training, and moderation of the library.
4. An AI instruction generator behind the existing interface.
5. Morphic: ship the `config.json` button to partner organisations (see `morphic/README.md`).
