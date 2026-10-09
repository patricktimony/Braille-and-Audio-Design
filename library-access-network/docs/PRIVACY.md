# Privacy and security

**This prototype is not suitable for real patron data.** Use only the fictional demonstration accounts.

## What the prototype already does

- Collects as little as possible: a username, a display name, a library, and an optional bio, skills, and accessibility preferences. It does **not** collect email, phone, address, birth date, library card number, or disability or medical information.
- Stores passwords only as salted **scrypt** hashes. The sample data never contains the demo password.
- Rotates the session token at sign-in. The cookie is `HttpOnly` and `SameSite=Lax`, and every form has a CSRF token.
- Escapes all user text. A strict Content-Security-Policy allows no scripts at all.
- Listens only on `127.0.0.1` (this computer) by default.
- Never collects JAWS speech output, keystrokes, or activity. There is no analytics or tracking.
- **Consent before publishing.** A conversation becomes a public knowledge-base entry only after everyone quoted agrees. Answers record their own sharing consent. Contributors can choose anonymous credit ("a patron at …") and can withdraw an entry later.
- Library-only discussions are visible only to that library's members and to network staff. Trainer requests are visible only to the patron and to staff.

## What must change before real use

1. Use real authentication through the library's identity system, with account recovery, lockout and rate limiting, and staff roles assigned by administrators instead of seed data.
2. Use persistent, encrypted session storage and HTTPS everywhere, and set `Secure` cookies.
3. Use a real database with encryption at rest, backups, and a retention policy (for example, delete trainer requests after 12 months).
4. Add an audit log for staff actions, moderation tools, and a way to report harmful posts.
5. Complete a privacy review against state library-records confidentiality laws (DC, Virginia, and Maryland all protect library patron records) and the libraries' own policies.
6. Let patrons export and delete their data.
7. Commission an independent security review.
