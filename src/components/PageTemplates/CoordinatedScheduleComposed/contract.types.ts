/**
 * Compile-time contract pins for the S2 live-wiring of the atomized schedule
 * topology. This file mirrors `CoordinatedProductsComposed/contract.types.ts`.
 *
 * STATUS: POST-PUBLISH TODO. `CoordinatedScheduleProps` and the
 * `CoordinatedSchedule` key on `CompositionComponentOverrides` are implemented
 * in the renderer's working tree but not yet published to npm (the renderer
 * version bump / publish is a separate gate). Once the renderer is published
 * and the package is bumped to the version that includes:
 *   - `CoordinatedScheduleProps` (from `src/composition/types.ts`)
 *   - `CompositionComponentOverrides.CoordinatedSchedule`
 * …uncomment the assertions below and delete this comment block.
 *
 * WHAT THE CONTRACT WILL PIN (post-publish):
 *   1. `CoordinatedScheduleComposed` is assignable to
 *      `ComponentType<CoordinatedScheduleProps>` — i.e. it accepts exactly the
 *      `{ shaped, slots, siteData, slug, initialView }` the renderer hands it.
 *   2. A `components` object carrying `CoordinatedSchedule` is assignable to
 *      `CompositionComponentOverrides` — valid to spread into
 *      `composePage`'s `options.components`.
 *
 * UNCOMMENT after bumping to the published version:
 *
 *   import type { ComponentType } from "react";
 *   import type {
 *     CompositionComponentOverrides,
 *     CoordinatedScheduleProps,
 *   } from "@hillbombcreations/site-renderer";
 *   import CoordinatedScheduleComposed from "./index";
 *
 *   const _overrideShape: ComponentType<CoordinatedScheduleProps> =
 *     CoordinatedScheduleComposed;
 *
 *   const _overrides: CompositionComponentOverrides = {
 *     CoordinatedSchedule: CoordinatedScheduleComposed,
 *   };
 *
 *   export const __coordinatedScheduleContract = {
 *     overrideShape: _overrideShape,
 *     overrides: _overrides,
 *   } as const;
 */

// File intentionally empty until the renderer is published with the new types.
export {};
