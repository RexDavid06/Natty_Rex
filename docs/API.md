# API reference

Base URL: `http://localhost:8000/api/v1`

- OpenAPI schema: `/api/schema/`
- Swagger UI: `/api/docs/`
- Health: `/health/`

Authenticated requests use `Authorization: Bearer <access>`. JSON is used everywhere except media uploads (`multipart/form-data`).

Error responses are normalised to:

```json
{ "detail": "Message", "errors": { "field": ["Message"] } }
```

List endpoints are paginated with `count`, `next`, `previous`, `results` unless noted otherwise (`page_size` can be supplied).

## Authentication (public)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login/` | Login with `identifier` (email or phone) and `password` |
| POST | `/auth/refresh/` | Rotate refresh token |
| POST | `/auth/logout/` | Blacklist refresh token |
| GET | `/auth/invitations/preview/?token=…` | Validate invitation, return client name |
| POST | `/auth/invitations/accept/` | Set password, activate account, return tokens |

Login response:

```json
{
  "access": "…",
  "refresh": "…",
  "user": { "id": "…", "email": "…", "full_name": "…", "role": "TRAINER", "avatar": null }
}
```

## Account (authenticated)

| Method | Path | Purpose |
| --- | --- | --- |
| GET/PATCH | `/auth/me/` | Read/update name and phone |
| POST | `/auth/password/` | Change password (`current_password`, `new_password`) |
| GET | `/auth/notifications/` | Paginated notifications |
| POST | `/auth/notifications/<id>/read/` | Mark one read |
| POST | `/auth/notifications/read-all/` | Mark all read |

## Trainer — dashboard and clients

All routes require the `TRAINER` role.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/trainer/dashboard/` | Stats, 6-week chart, recent activity, upcoming sessions |
| GET/POST | `/clients/` | List/search (`q`, `status=active|inactive`) or create client + invitation |
| GET/PATCH/DELETE | `/clients/<id>/` | Read/update/delete (only if no assignments) |
| POST | `/clients/<id>/activation/` | `{ "active": true|false }` |
| GET | `/clients/<id>/overview/` | Client, stats, assignments, history, progress, notes |
| GET/POST | `/clients/<id>/invitations/` | List/create invitations |
| GET/POST | `/clients/<id>/progress/` | List/create progress entries (upsert by date) |
| GET/POST | `/clients/<id>/notes/` | List/create trainer notes |
| GET | `/clients/<id>/history/` | Completed workouts |
| DELETE | `/invitations/<id>/` | Revoke unused invitation |
| POST | `/invitations/<id>/regenerate/` | Revoke old and issue new invitation |
| DELETE | `/notes/<id>/` | Delete trainer note |

Creating a client body:

```json
{
  "full_name": "Jordan Lee",
  "email": "jordan@example.com",
  "phone": "+15550101010",
  "gender": "PREFER_NOT_TO_SAY",
  "date_of_birth": "1996-04-18",
  "fitness_goals": "Build strength",
  "training_notes": "Previous shoulder injury",
  "send_invitation": true
}
```

The response includes `has_account` and, when newly created, `invitation.invite_url`. That raw link is returned only once.

## Trainer — exercise library and media

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/exercises/` | List/search/filter or create exercise (`q`, `muscle_group`, `category`, `include_archived=true`) |
| GET/PATCH/DELETE | `/exercises/<id>/` | Read/update/delete exercise |
| POST | `/exercises/<id>/media/` | Upload media (`file` or `external_url`) |
| PATCH/DELETE | `/exercise-media/<id>/` | Change metadata/preferred flag or delete |

Media fields: `kind` (`VIDEO`, `ANIMATION`, `IMAGE`), `title`, `description`, `file`, `external_url`, `thumbnail`, `is_preferred`. Allowed uploads: MP4/WebM/QuickTime video, GIF/WebP/PNG/JPEG. Maximum size is `MAX_UPLOAD_MB`.

## Trainer — programs and builder

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/programs/` | List/create program; creation generates weeks and weekday rows |
| GET/PATCH/DELETE | `/programs/<id>/` | Read/update/delete (delete blocked after assignment) |
| POST | `/programs/<id>/assign/` | `{ "client_ids": ["…"] }` — assign to clients |
| GET/PATCH | `/weeks/<id>/` | Read/update week notes |
| POST | `/weeks/<id>/copy/` | `{ "source_week_id": "…" }` |
| GET/PATCH | `/days/<id>/` | Read/update rest day/notes |
| POST | `/days/<id>/copy/` | `{ "source_day_id": "…" }` |
| POST | `/days/<id>/sessions/` | Create session |
| PATCH/DELETE | `/sessions/<id>/` | Update/delete session |
| POST | `/sessions/<id>/exercises/` | Add library exercise (`exercise_id`) or custom (`exercise_name`, `muscle_group`, `sets`, `reps`, …) |
| POST | `/sessions/<id>/reorder/` | `{ "exercise_ids": [...] }` — every ID exactly once |
| PATCH/DELETE | `/workout-exercises/<id>/` | Update/remove prescription |
| DELETE | `/assignments/<id>/` | Cancel assignment |

Program body:

```json
{
  "name": "Off-season Strength",
  "description": "Three-day strength block",
  "objective": "STRENGTH",
  "start_date": "2026-11-09",
  "weeks_duration": 8,
  "status": "ACTIVE"
}
```

Assignment body:

```json
{ "client_ids": ["<client-profile-uuid>"] }
```

## Client application

All routes require the `CLIENT` role.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/client/assignments/` | Current and historical assignments |
| GET | `/client/dashboard/` | Today, current week, next workout, overall progress |
| GET | `/client/calendar/?week=1&assignment=<id>` | Week day/session breakdown |
| GET | `/client/sessions/<id>/` | Session detail with media and completion state |
| POST | `/client/sessions/<id>/complete/` | Complete session (`notes`) after all exercises |
| POST | `/client/exercises/<id>/complete/` | Log `actual_sets`, `actual_reps`, `actual_weight`, `notes` |
| DELETE | `/client/exercises/<id>/complete/` | Undo exercise while session is unfinished |
| GET | `/client/history/` | Completed workouts |
| GET/POST | `/client/progress/` | Read/create own progress entries |

Exercise logging body:

```json
{
  "actual_sets": 4,
  "actual_reps": "6",
  "actual_weight": "102.5",
  "notes": "Felt strong, depth good"
}
```

Workout completion body:

```json
{ "notes": "Energy was high; sleep 8h" }
```

## Status codes

| Code | Meaning |
| --- | --- |
| 200/201/204 | Success |
| 400 | Validation or business rule failure |
| 401 | Missing/expired token |
| 403 | Wrong role or assignment permission |
| 404 | Not found or intentionally hidden cross-tenant resource |
| 413 | Upload exceeds `MAX_UPLOAD_MB` |
| 429 | Throttled (login/invitations) |
