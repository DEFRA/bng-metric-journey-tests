# Downstream Failures Flow

## Overview

Proves the service answers with an error page, rather than hanging or crashing, when a system it depends on fails, and that it recovers without a restart. Ticket: BMD-1189.

These tests run only against the Docker Compose stack with `compose.resilience.yml` applied, through `npm run test:resilience`. They are excluded from the main suite, because a fault would break every other test running at the same time, and they never run on CDP.

Faults are injected by [Toxiproxy](https://github.com/Shopify/toxiproxy), which sits between a service and its dependency:

| Fault  | Simulates                                      | Toxiproxy mechanism        |
| ------ | ---------------------------------------------- | -------------------------- |
| `down` | Dependency unreachable (connection refused)    | Proxy disabled             |
| `hang` | Dependency connected but never answers a query | `timeout` toxic, timeout 0 |

Tests assert three things: an error page is rendered, it arrives within a bound, and the page works again once the fault clears. They deliberately do not assert the status code. It differs by route (a Postgres hang is 504 on `/manage-projects` but 502 on routes using `fetchProjectOrThrow`), and the bare code heading is a known content gap rather than behaviour to lock in.

## Steps

### Step 1 — Postgres unreachable `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Fault:** backend → Postgres `down`
- **On error:** generic error page, immediately
- **Recovery:** dashboard lists the user's project once the fault clears

### Step 2 — Postgres not answering `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Fault:** backend → Postgres `hang`
- **On error:** generic error page when the frontend's 10s backend timeout (`BACKEND_TIMEOUT_MS`) fires
- **Recovery:** dashboard lists the user's project once the fault clears

### Step 3 — Other dependencies `[PLANNED]`

S3, CDP Uploader, the backend itself and Redis. Awaiting the outcome of the BMD-1189 proof of concept.
