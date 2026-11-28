# Convention source policy

`/conventions` uses **different sources for different fields**. No source is allowed to overwrite every field.

## Field ownership

| Data | Primary source | Notes |
| --- | --- | --- |
| Dates, venue, city, state | Official organiser city page (`comicconindia.com`, `animeindia.live`) or official JSON-LD (`tickets.comicconindia.com`, `otatokyo.jp`) | Organiser/ticket portal only. A shorter venue label never replaces a more specific stored hall/landmark. |
| Main Stage schedule | Comic Con India official city page | Reported as a review note; the convention table has no schedule field. |
| Guest announcements | Anime India official site, ANN / NODWIN / AnimationXpress | Official pages may be reviewed; news feeds are advisory signals only and never write fields. |
| Ticket link | Comic Con India ticket portal, Anime India official site, Ōta TOKYO official site | District/BookMyShow links are verified on the organiser page before use. |
| Ticket availability | Official ticket JSON-LD, District/BookMyShow listing | Availability is a note, not a permanent event fact. |
| Discovery of new events | `rostercon.com/en/location/india` | Discovery only. Roster Con states it is not a convention organiser; its listings are never auto-synced. |

News feeds (ANN, NODWIN Gaming, AnimationXpress) are **never called by the auto-sync**. They stay in the optional manual review tool only.

## Automatic daily sync (no manual step)

The unattended path is:

```text
.github/workflows/cron.yml  →  GET /api/cron/conventions-refresh  →  syncConventionSources()
```

- The workflow runs daily at `0 12 * * *` (12:00 UTC / 17:30 IST) using the existing `BASE_URL` and `CRON_SECRET` repo settings.
- The endpoint uses the same fail-closed `CRON_SECRET` auth as the other `/api/cron/*` routes.
- `src/lib/convention-auto-sync.ts` checks only public, non-cancelled, non-archived conventions.
- Only changes produced by authoritative organiser/ticket sources can be written.
- One combined write per event avoids a temporary invalid date range.
- `/conventions`, `/conventions/[id]` and `/api/conventions` caches are revalidated after a successful check.

Auto-sync additionally refuses:

- news feeds and the discovery aggregator (they are not even fetched),
- fields outside the allowlist (`name`, `startDate`, `endDate`, `venue`, `city`, `state`, `ticketUrl`, `image`),
- URLs outside the trusted host of the claimed source,
- stale approvals whose `currentValue` no longer matches the stored record,
- past dates or a combined range where start is after end,
- image/ticket URLs that are not reachable,
- hidden (`isPublic: false`) rows at both select and write time.

Status labels continue to be derived automatically from stored dates in India time.

## Manual audit tool (optional)

```bash
npx tsx scripts/conventions-watch.ts
```

This writes `data/convention-review/latest.json` and `latest.md` (under the already ignored `data/` directory). It fetches only public active conventions, builds a field-level diff, and prints the counts. **It does not write to the database.**

If a human wants to publish one of those reviewed changes from the CLI:

```bash
npx tsx scripts/conventions-watch.ts --apply data/convention-review/latest.json
```

Only proposals explicitly switched to `decision: "approved"` are applied, and all the same source/host/staleness guards still run.
