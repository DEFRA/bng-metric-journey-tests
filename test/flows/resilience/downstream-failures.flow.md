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

### Step 1 — Postgres failing on the project dashboard `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Fault:** backend → Postgres `down` and `hang`
- **On error:** generic error page, immediately or when the frontend's 10s backend timeout (`BACKEND_TIMEOUT_MS`) fires
- **Recovery:** dashboard lists the user's project once the fault clears

### Step 2 — Postgres failing on a project page `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/project-summary`, which loads the project through `fetchProjectOrThrow`
- **Fault:** backend → Postgres `down` and `hang`
- **On error:** generic error page, immediately or at the frontend's 10s backend timeout
- **Recovery:** the project loads once the fault clears. With no baseline it moves on to the file-type selection page.

### Step 3 — Postgres failing while saving a new project `[IMPLEMENTED]`

- **Route:** `POST /project-name`
- **Fault:** backend → Postgres `down` and `hang`, after the name page has opened
- **On error:** generic error page, immediately or at the frontend's 10s backend timeout
- **Recovery:** retrying with the same name saves it, and the dashboard shows exactly one project with that name

### Step 4 — Postgres failing during the file check `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`, after submitting a baseline file
- **Fault:** backend → Postgres `down` and `hang`, after the upload page has opened. The browser posts the file to the uploader directly, so the upload itself succeeds.
- **On error:** generic error page, within the frontend's limits for the file check
- **Recovery:** the same file uploads successfully once the fault clears

### Step 5 — Redis unreachable `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`, signed in
- **Fault:** frontend → Redis `down`
- **On error:** generic error page, immediately (`errorOnCacheNotReady` in the frontend's `session-cache.js`)
- **Recovery:** dashboard lists the user's project once the fault clears

### Step 6 — Redis not answering `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`, signed in
- **Fault:** frontend → Redis `hang`
- **On error:** generic error page, when the session read hits the frontend's Redis command timeout (`REDIS_COMMAND_TIMEOUT_MS`, 2s). Before BMD-1200 there was no timeout, and the page never responded.
- **Recovery:** dashboard lists the user's project once the fault clears. The frontend's Redis socket timeout (`REDIS_SOCKET_TIMEOUT_MS`, 3s) drops the connection that lost its replies, so the client reconnects.

### Step 7 — S3 failing during the file check `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`, after submitting a baseline file
- **Fault:** backend → S3 `down` and `hang`. The uploader keeps its own S3 connection, so the upload itself succeeds.
- **On error:** generic error page, within the frontend's 25s budget for the file check (`BACKEND_VALIDATE_TIMEOUT_MS`)
- **Recovery:** the same file uploads successfully once the fault clears

The file check is the only time the backend reads S3 while handling a request. It may read report fonts at startup, and falls back to bundled fonts if it can't.

### Step 8 — CDP Uploader failing when the upload page opens `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-baseline-file`
- **Fault:** backend → CDP Uploader `down` and `hang`
- **On error:** generic error page, immediately or at the frontend's 10s backend timeout
- **Recovery:** the upload form renders once the fault clears

### Step 9 — CDP Uploader failing during the file check `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`, after submitting a baseline file
- **Fault:** backend → CDP Uploader `down` and `hang`. The browser posts the file to the uploader directly, so the upload itself succeeds.
- **On error:** "Checking your file" until the frontend's 120s limit (`MAX_WAIT_SECONDS`), then the upload page with "The file check timed out. Please try again." The upload page cannot start a new upload while the uploader fails, so it shows "Unable to start file upload. Please try again later." in place of the form. Before BMD-1200 the message was lost, and the user got the generic error page.
- **Recovery:** the same file uploads successfully once the fault clears

### Step 10 — Browser posting a file to a failing CDP Uploader `[BLOCKED: not reachable through the proxy]`

The browser talks to the uploader directly, so the service can't answer for this path. In a throwaway lab, a browser got its own error page when the uploader was down, and no feedback by a 60s cap when it hung. Those results would not carry over to CDP, where the platform sits between them.

### Step 11 — Backend failing `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Fault:** frontend → backend `down` and `hang`
- **On error:** generic error page, immediately or at the frontend's 10s backend timeout
- **Recovery:** dashboard lists the user's project once the fault clears

### Step 12 — File check still running after 2 minutes `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`, after submitting a baseline file
- **Setup:** the backend's uploader proxy points at `cdp-uploader-pending`, which passes everything to the real uploader except status checks, which always answer "pending". Nothing fails.
- **Result:** after the frontend's 120s limit, the upload page with "The file check timed out. Please try again."
- **Recovery:** the same file uploads successfully once the proxy points back

### Step 13 — File checker still busy after 2 minutes `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`, after submitting a baseline file
- **Setup:** the frontend's backend proxy points at `bng-metric-backend-busy`, which has `VALIDATION_ADMISSION_LIMIT=0`, so it answers every file check with "busy"
- **Result:** after the frontend's 120s limit, the upload page with "The service is busy checking other files. Please try again in a few moments."
- **Recovery:** the same file uploads successfully once the proxy points back

### Step 14 — Saving or uploading while another edit holds the project `[IMPLEMENTED]`

- **Routes:** `POST` from the baseline habitat details form, and `GET /projects/{id}/upload-received` after submitting a baseline file
- **Setup:** the test holds the project's row lock through `test-postgres`, as another user's save would. The backend gives up after its 5s `lock_timeout`.
- **Result:** the error page with "Another user is editing this. Please try again." (409). Reachable for saves since backend PR #591, and for uploads since BMD-1200: before it, the frontend sent an upload conflict to the file error page.
- **Recovery:** the save, or the upload of the same file, works once the lock is released

### Step 15 — Sign-in expired and can't be renewed `[IMPLEMENTED]`

- **Routes:** `GET /manage-projects` and the report PDF route
- **Setup:** a throwaway user signs in through the stub, then the test edits that user's session through `test-redis`: the access token is expired and the refresh token is rejected. The shared session is never touched.
- **Result:** a redirect to `/auth/session-expired`, with its "Sign in again" button and "Return to the home page" link

## Ticket scenarios outside this suite

A file rejected by the CDP Uploader needs no fault, so it runs in the main suite, in the upload specs ("CDP Uploader rejection"), on the stub stack only.

"Unable to start file upload" (ticket scenario 5) has no test of its own. Since BMD-1200 Step 9 shows it, with the timed-out message.
