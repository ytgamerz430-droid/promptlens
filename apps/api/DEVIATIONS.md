# API deviations from docs/API_CONTRACT.md

None material. Minor notes:

1. **`PROVIDER_NOT_CONFIGURED` status code** — the contract's code table lists
   this as 503, but the Auth (Google), Tracker, and Billing sections explicitly
   specify `501 { error: { code: "PROVIDER_NOT_CONFIGURED" } }`. The per-endpoint
   spec wins: those three cases return **501**.

2. **Additive response fields** (all contract shapes are a subset of what is
   returned):
   - `job` includes `byok: boolean` and `batchId: string | null`.
   - `metadata` job output includes `warnings: string[]` (limit violations that
     survived the one automatic retry).
   - `POST /redeem` and `POST /tasks/:id/claim` also return the updated
     `credits` balance alongside `creditsAdded`.
   - `GET /reviews` items expose `createdAt` (camelCase).

3. **`GET /reviews/me`** added (observed in the target's client bundle per
   docs/RECONNAISSANCE.md §8). Returns the caller's own review or
   `{ review: null }`.

4. **Reviews start empty** — `GET /reviews/summary` returns
   `{ average: 0, count: 0 }` and `GET /reviews` returns an empty list until
   users post reviews (no seeded fake reviews).

5. **Tracker endpoints charge 1 credit** like any other job (refunded on
   provider failure), since they are wrapped as jobs for uniform history.

6. **Billing checkout** returns 501 even when `STRIPE_SECRET_KEY` is set: the
   stub is in place with a TODO comment; a real Stripe integration is
   intentionally not half-shipped.

7. **multer 2.x** is used instead of 1.x (1.x has published vulnerabilities;
   the API surface used here is identical).

8. **`npm test` runs `node --test "test/*.test.js"`** — the bare
   `node --test test/` directory form fails with MODULE_NOT_FOUND on this
   Node 24.20.0 build; the glob form works and runs the same files.

9. **Batch `tool` validation** — `POST /jobs/batch` accepts only
   `prompt` and `metadata` per the contract; other tools return 422.
