# Jira Ticket Extraction — Reference

Shared reference for pulling ticket details from Jira (`eaflood.atlassian.net`) via the REST API. Used by `/validate-ac-manual` and `/validate-adhoc-implementation` when the user opts into Jira-API sourcing.

`WebFetch`/browser fetching does **not** work against this instance — SSO returns an empty SPA shell. Always use `curl` with the API token.

---

## Credentials & ground rules

- Credentials live in `~/.jira.env` (gitignored, `chmod 600`, never committed):
  `JIRA_BASE=https://eaflood.atlassian.net`, `JIRA_EMAIL=<atlassian-account-email>`, `JIRA_API_TOKEN=<token>`.
- Load them per command: `set -a; . ~/.jira.env; set +a`
- **Never print or echo the token.** Read-only: **GET requests only** — never create, edit, transition, or comment on issues.
- If `~/.jira.env` is missing or auth fails, stop, tell the user, and fall back to the manual input path.

Verify auth before anything else:

```sh
set -a; . ~/.jira.env; set +a
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -H "Accept: application/json" \
  "$JIRA_BASE/rest/api/3/myself" | head -c 200
```

---

## Fetch the issue

```sh
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -H "Accept: application/json" \
  "$JIRA_BASE/rest/api/3/issue/<KEY>?expand=renderedFields" > <scratchpad>/issue.json
```

Do **not** pass a `fields=` filter — the acceptance criteria live in custom fields you must scan for. Save the JSON to the scratchpad and parse from the file (it is large).

Key locations in the response:

| What                | Where                                                     |
| ------------------- | --------------------------------------------------------- |
| Ticket key / title  | `key`, `fields.summary`                                   |
| Description         | `fields.description` (ADF document)                       |
| Acceptance criteria | populated `fields.customfield_*` entries (see below)      |
| Comments            | `fields.comment.comments[]` (ADF bodies)                  |
| Attachments         | `fields.attachment[]` (`filename`, `mimeType`, `content`) |
| Linked issues       | `fields.issuelinks[]`                                     |
| Numeric issue id    | `id` (needed for the dev-status PR endpoint)              |

## Acceptance criteria (the tricky part)

- The instance has ~40 "Acceptance Criteria" custom fields. Scan **every populated** `customfield_*` for AC-shaped content — do not go by the field-name list.
- ACs may span **multiple** custom fields (e.g. BMD-597 had SET 1 in `customfield_19051` and SET 2 in `customfield_20938`). Cross-check the summary/description's action list to spot AC sets a single field misses.
- Parse the **raw ADF JSON**, not `renderedFields` HTML: ADF tables are stubbed in HTML as `<!-- ADF macro (type = 'table') -->`. Walk `table`/`tableRow`/`tableCell`, `heading`, `bulletList`/`orderedList`/`listItem`, and `paragraph`/`text` nodes to reconstruct the text.

## Pull requests

1. **Development info** (preferred — this is what the "Development" panel shows):

   ```sh
   curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -H "Accept: application/json" \
     "$JIRA_BASE/rest/dev-status/latest/issue/detail?issueId=<numeric-id>&applicationType=GitHub&dataType=pullrequest"
   ```

   Extract repo name, PR number/URL, and status per PR.

2. **Fallbacks:** `GET /rest/api/3/issue/<KEY>/remotelink`, and `github.com/...` PR URLs mentioned in the description or comments.
3. If nothing is found, report "no PRs linked on the ticket" — do not guess.

## Attachments / supporting documents

List from `fields.attachment[]`; download with the same auth (the `content` URL redirects):

```sh
curl -s -L -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -o "<dest-dir>/<filename>" "<content-url>"
```

## Comments → Notes

Walk `fields.comment.comments[].body` (ADF) and extract clarifications, scope decisions, and exclusions — these feed the **Notes** section of `feature-input.md` or the adhoc validation context. Ignore bot/CI noise.
