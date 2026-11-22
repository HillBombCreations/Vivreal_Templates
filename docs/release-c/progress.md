# Release C, Vivreal_Templates batch (C-TPL): progress

Branch `release-c/templates`, from `stable` `c5b4a6be148f3bc8dff78047732eff10cdb63f2f`. Spec: vivreal-hq
`docs/projects/next-release-C/plan-release-C.md` 3.10 (23 rows) with Deltas 1 to 3 and their fix passes, and the
designs each row names. One builder, one PR against `stable`; not merged until the batch is walked (P-keep-prs-open).

Tests run on a clone on WSL's own disk (Node 24.22.3, npm 11.19.1, `npm ci` with the lockfile byte-identical after),
each red proof in a read-only base worktree of `c5b4a6be` with only the test files copied in. "Red at base" names the
assertions that failed there; a row whose module is new ran its test against an empty stand-in module, so the red is
an assertion (the namespace check), never a load error.

| # | Row | Commit | Tests (ALLOW and REFUSE on one mechanism) | Red at base |
|---|---|---|---|---|
| 1 | F323 home pages, T-323-1 (stub first) | `7d01ad9` | `scripts/no-script-read.test.mjs`: 3 REFUSE (BR-04 home, help article ratio 0.196, text only hidden), 2 ALLOW | against the stub measure: the 3 REFUSE failed, 4 passed |
| 2 | F323 (F424 folded) | `8cf009c` | `src/lib/pageBoundaries.test.ts` (T-323-2); `scripts/isr-build-check.test.mjs` `checkNoScriptReads` (T-323-3, pure half); two pins re-anchored (N1) | T-323-2: 3 of 10 (three page boxes, three over the allowlist, the `.tsx` overrides missing) |
| 3 | F608 frame rule and header set | `6d0a3e2` | `src/lib/securityHeaders.test.ts` through the shipped `next.config.ts`; `hsts.test.ts` moved from a source pin to the shipped headers | 9 of 9 |
| 4 | PRL-RA11 script policy switch (watching), F478 | `4d72865` | `scriptPolicy.test.ts` T-SP-1 to T-SP-4, F478 2, 4, 5 | 11 of 39 (F478 1 and 4 are guards, green at base by design) |
| 5 | F430 Next.js 16.4.5 | `da9e4f2` | tests that read Next internals, 147 of 147 at 16.4.5; lockfile: 10 entries patched, 123 optional entries before and after, npm 10 dry run ok | n/a (a pin) |
| 6 | F589 site engine 1.102.0 with the D-26 type line | `d91bfbf` | whole suite 3,244 of 3,244; control: without the type line `tsc` fails TS2322 at `cartProduct.ts:31` | n/a (a pin) |
| 7 | F570 PB-T1 (T-T1) | `3f60090` | `customerComposeOptions.test.ts`, `customerComposeOptionsBasePath.test.ts` through the real `buildPageContext` and 1.102.0 | the two kept mutations, each red alone on a scratch copy: (1) the literal: both key sets, the render REFUSE, the sweep and `pageEmptinessDraws.test.ts:304` (expected); (2) the `[slug]` spread: the sweep |
| 8 | F417 per-size threshold | `024b6db` | `transformProduct.test.ts` ALLOW and REFUSE; `lowStockThreshold.parity.test.ts` against the engine's reader | 2 of 2 |
| 9 | Cart long names | `bd880a0` | `CartDialog.test.ts` ALLOW and REFUSE | 2 of 2 |
| 10 | F607 contact route | `9182445` | `route.test.ts` F607 REFUSE and ALLOW through the real route | both |
| 11 | F392 cart stock notes (N5, N6) | `afdbd4f` | `cartStock.shared.test.ts` N6 REFUSE x2, N5 REFUSE, ALLOW x2 | 3 REFUSE |
| 12 | F426 D4, tier half | `5d25420` | `cartSettings.test.ts` ALLOW and REFUSE | 3 of 3 rows |
| 13 | F429 part 2 | `a1ceb84` | `cartSettings.test.ts` REFUSE and ALLOW on the real `pickupWindows` | 2 of 2 |
| 14 | F432 16 px fields | `01962dc` | `cartFieldTextSize.test.ts` ALLOW and REFUSE with a must-hit control | 2 of 3 (the control is green by design) |
| 15 | F160 network guard | `2292884` | `scripts/network-test-guard.test.mjs` 3 REFUSE, 1 ALLOW; whole suite 3,273 under the guard | 4 of 4 |
| 16 | F581 | none | no code (rebuild design 4.2, T1) | n/a |
| 17 | F526 seasonal: the bag total | `7ece617` | `cartRefusedTotal.test.ts` T12 REFUSE and ALLOW | 2 of 2 |
| 18 | SQP-T1 Square questions in the cart | `9737ac7` | `cartAsks.questions.test.ts` T-SQQ-1, T-SQQ-2, QUESTION_REQUIRED | 5 of 5 |
| 19 | SQP-T2 newsletter tick, Stripe and Square | `3ebff63` | `cartAsks.joinList.test.ts` T-SQN-1, T-SQN-2 | 4 of 4 |
| 20 | SQP-T3 quick doors | `56e8bc1` | `cartAsks.doors.test.ts` T-SQQ-3 | 4 of 4 |
| 21 | SQP-T4 the forwarder | `1c2a6c2` | `route.cartAsks.test.ts` T-SQQ-4 through the real route | 3 of 4 (the joinList REFUSE holds at base: it forwards neither key) |
| 22 | Stylesheet retry (VIVREAL-TEMPLATES-Q) | `3eafbfb` | `stylesheetLoad.test.ts` | 8 of 8 |
| 23 | Shell read deadline (SW-C28) | `f10aa84` | `cacheInvalidation.quiet.test.ts` SW-C28 ALLOW and REFUSE; two pins to 2,500 | 4 (the two pins, the two SW-C28 rows) |

## Batch head gates

- `npm run lint`: exit 0, 0 errors, 2 warnings in files this batch does not touch (`src/app/icon.tsx:61`,
  `src/app/apple-icon.tsx:61`, an unused disable directive).
- `npm test` (`tsc --noEmit`, then every suite): exit 0, 3,302 of 3,302.
- `seedCopy.test.ts` W25f-1 (a timing test) failed once under machine load during a targeted run and passed on the
  rerun and in every later run; the file is untouched.

## Deviations from the plan, each with its reason

- **SQP-T3 reads a question off the quote, not the product.** FP1.4 reads `checkoutQuestion.on` off the product a
  door holds and records `asks` on each bag line. That product is the renderer's `DetailProductData`, built field by
  field by `contentItemToProduct`, so the key never reaches a door without a renderer publish (none in C). On a
  Square shop only, each door asks the cart quote, which carries the question (SV-SQ10); a failed quote counts as
  asking. Same behaviour as T-SQQ-3; Stripe shops make no extra request.
- **F607 removes the `@hillbombcreations/email-brand` dependency.** With the route no longer building the owner's
  email, its builders and the import had no caller. Removed from `package.json` and its one lockfile entry.
- **SQP-T2 is on both providers**, per the owners' answer `decisions.md:1170` and the square parity design's fix
  pass of 2026-11-21 (the plan's 3.10 row still says "Square cart tick").
- **F392:** N5 and N6 built; N1 (release B's PR body), N2 and N3 (heal on the next add, undersell only) and N7 (the
  per-line rule since `7833991`, never 0) left, each with its reason in the commit.

## F323 B-323-1 (the build check, `f75e881`)

The check's fixture drew no section (every block typed `page-template`) and its Linux server stop left `next start`
running; both fixed in `f75e881`. Then, each a full build and serve on WSL:

| Tree | Gate on | Gate off |
|---|---|---|
| F323's tip `8cf009c` (Next 16.4.1, engine 1.101.0) | every measured path complete except `/shop`, `/menu`; `checkAfterFlip` and F41 green | the same |
| Batch head | the same as F323's tip | the same |
| Head's check against the base app code (F323's app commit reverted) | red on `/`, `/about`, `/links`, `/book`, `/shop`, `/menu`, `/events`, `/faq?q=loaf`, each naming a hidden `<h1>` or the ratio | the same |
| Probe: F323's tip with the two shop boxes removed (never committed) | `/shop`, `/menu` complete; `/about` 500 after the owner adds a shop (`checkAfterFlip` red, design B1) | PASS |

**Unsettled, for the architect:** `/shop` and `/menu` fail at F323's own tip. The shop section's own box (design
4.1, pass 2) streams in a request render (its content lands in a hidden segment), against the design's premise that
in a request render the box never shows its fallback. Removing the box fixes the request render and breaks the stored
page that gains a shop (B1). Not a regression: before F323 the whole shop page was hidden; now the menu, title and
footer arrive and only the shop section waits. A fix that keeps both (for example, the shop hook reading the query
the route already parsed instead of `useSearchParams()`, so no box is needed) is a design change, not built here.

## Fleet diff (P-template-validate, P-fleet-diff)

- Diff 1, the site engine 1.102.0 alone: fleet diff D-26 (hq `fleet-diff/D-26-fleet-diff-1.md`), the same published
  bytes (its candidate's integrity `sha512-qUesVOl2...K/V0Cw==` equals the registry 1.102.0 this batch pins), the same
  Templates base `c5b4a6be` and the same type line. Not re-run.
- Diff 2, the Templates changes: every Templates app (41) built twice, base = `c5b4a6be` plus `d91bfbf` (1.102.0 and
  the type line, D-26's head tree), head = this batch; served and pair-diffed with release B's harness (sha256
  `8dd20201...73abfe`). Report: hq `fleet-diff/C-TPL-fleet-diff-2.md` (hq `08b198b1`).
- **Result (2026-11-22 00:06Z to 01:06Z):** 41 of 41 built both ways (tree proof 41 of 41); 1,480 addresses
  (1,224 pages); 0 status, 0 cache class, 0 head non-2xx differences; 650 pages changed, every one named: F323 647
  (the waiting box gone, the body sent whole; text, links, images unchanged), F417 3 (Waves of Grain: "Only 4 left"
  gone on two cards and two product pages, no size low by its own number). **Unnamed: 0.** Classifier control: a
  planted sentence is reported unnamed. 0 secret values in any written log.
