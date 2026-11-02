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

### Step 3 — Redis unreachable `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`, signed in
- **Fault:** frontend → Redis `down`
- **On error:** generic error page, immediately (`errorOnCacheNotReady` in the frontend's `session-cache.js`)
- **Recovery:** dashboard lists the user's project once the fault clears

### Step 4 — Redis not answering `[BLOCKED: known defect, no Redis command timeout]`

- **Route:** `GET /manage-projects`, signed in
- **Fault:** frontend → Redis `hang`
- **On error:** should be the generic error page, but the page currently never responds. The test is marked `test.fail`, so it goes red once the defect is fixed.

### Step 5 — S3 failing during the file check `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`, after submitting a baseline file
- **Fault:** backend → S3 `down` and `hang`. The uploader keeps its own S3 connection, so the upload itself succeeds.
- **On error:** generic error page, within the frontend's 25s budget for the file check (`BACKEND_VALIDATE_TIMEOUT_MS`)
- **Recovery:** the same file uploads successfully once the fault clears

### Step 6 — CDP Uploader failing when the upload page opens `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-baseline-file`
- **Fault:** backend → CDP Uploader `down` and `hang`
- **On error:** generic error page, immediately or at the frontend's 10s backend timeout
- **Recovery:** the upload form renders once the fault clears

### Step 7 — CDP Uploader lost during the file check `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`, after submitting a baseline file
- **Fault:** backend → CDP Uploader `down`. The browser posts the file to the uploader directly, so the upload itself succeeds.
- **On error:** "Checking your file" until the frontend's 120s limit (`MAX_WAIT_SECONDS`), then the generic error page. The "file check timed out" message is lost, because the upload page clears it and then fails to load. This is a known defect, which the test does not assert.
- **Recovery:** the same file uploads successfully once the fault clears

### Step 8 — Browser posting a file to a failing CDP Uploader `[BLOCKED: not reachable through the proxy]`

The browser talks to the uploader directly, so the service can't answer for this path. In a throwaway lab, a browser got its own error page when the uploader was down, and no feedback by a 60s cap when it hung. Those results would not carry over to CDP, where the platform sits between them.

### Step 9 — Backend failing `[PLANNED]`

Frontend → backend. The ticket does not name it, and it is awaiting the outcome of the BMD-1189 proof of concept.
