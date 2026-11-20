---
name: PostgreSQL test isolation
description: Safe database setup for app-level E2E tests.
---

Do not assume setting PostgreSQL `search_path` isolates a test run. A migration push configured for a temporary schema left that schema empty, while app writes fell through to the public schema. Browser page loads are not necessarily read-only: login and overdue-quest processing can mutate character, quest, penalty-log, and celestial-power state, even during screenshot capture.

**Why:** UI testing changed real character progress and a preview load triggered overdue penalties, even though a dedicated test schema was intended.

**How to apply:** Use a separate disposable database or explicitly schema-qualified test connection. Before browser testing, verify the expected tables are in the isolated target and read back a harmless marker. Treat page loads as potentially mutating, and never use the active user profile as a test fixture.
