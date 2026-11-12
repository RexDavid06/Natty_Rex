# Testing

## Run everything

```bash
make test
```

This runs Django's test runner followed by Vitest.

Individual suites:

```bash
cd backend && python manage.py test
cd frontend && npm test

# Watch mode
cd frontend && npm run test:watch

# Typecheck / lint
cd frontend && npm run lint
cd backend && python manage.py check
```

## Backend suite

The Django tests use an isolated in-memory SQLite database and temporary media root. They cover:

- Email and phone login, inactive accounts, JWT refresh rotation and logout blacklisting.
- Password changes and profile updates.
- Invitation preview, acceptance, single-use enforcement, expiry, revocation and regeneration.
- Client creation/search/filter/update/activation. Cross-trainer access returns 404.
- Trainer notes and progress upsert semantics.
- Program creation generating weeks/weekdays, session and exercise creation, default inheritance.
- Exercise reordering validation, day/week copy, assignment and cancellation.
- Exercise media validation, upload, preferred-media switching, cross-trainer isolation.
- Deleting a library exercise without destroying historical prescriptions.
- Client dashboard/calendar scheduling (Monday-aligned weeks), session detail.
- Exercise logging, workout completion rules, history, progress, notifications.
- Trainer dashboard completion statistics and client/trainer permission boundaries.

Run a single module:

```bash
cd backend
python manage.py test accounts.tests.test_auth
python manage.py test training.tests.test_program_builder
python manage.py test training.tests.test_client_workouts
```

Optional pytest tooling is listed in `backend/requirements-dev.txt`, but Django's test runner is the supported default:

```bash
python manage.py test --verbosity 2
```

## Frontend suite

Vitest + Testing Library + jsdom. `src/test/setup.ts` installs `jest-dom`, `matchMedia` and `ResizeObserver` mocks.

Current coverage:

- API client attaches bearer tokens, sends JSON, handles anonymous requests, refreshes/retries on 401, emits session-expiry and clears tokens on failed refresh, handles 204 and field-level validation messages.
- Formatting helpers (`formatDate`, `formatDateTime`, initials, title case, pluralisation, class merging).
- Client home rendering: empty program state and today's workout/calendar card with accessible links.

Add tests beside the source file as `*.test.ts` / `*.test.tsx`. Mock network calls through `vi.stubGlobal("fetch", ...)` or mock `src/lib/api`.

```bash
cd frontend
npx vitest run src/lib/api.test.ts
```

## Manual QA checklist

1. Trainer login, invite a client, accept in a private browser.
2. Exercise library: create exercise, upload media, set preferred, delete/archive.
3. Program builder: create weeks, add/copy sessions, reorder exercises, assign two clients.
4. Client: open today's workout, view media/form cues, log partial performance, complete all exercises and the session.
5. Verify history, progress check-in, trainer dashboard activity and notifications.
6. Install the PWA, go offline, confirm the shell loads and API calls are not served from cache.
7. Verify a client cannot open trainer routes and trainer A cannot open trainer B's client/program URLs.

## Environment caveats

- PostgreSQL cannot be initialised in this Termux-like environment; local tests use SQLite.
- Pillow is not installed and not required. Media tests upload tiny bytes with explicit content types.
- If npm cannot reach the registry, use the committed lockfile with `npm install --offline`.
