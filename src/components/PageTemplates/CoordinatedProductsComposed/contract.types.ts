/**
 * Compile-time contract pins for the G4 part ① live-wiring of the atomized
 * products topology. There is no runtime test harness in Vivreal_Templates
 * (no test script / no test files — verified 2026-06-22), so the wiring is
 * guarded at the TYPE level instead. `tsc --noEmit` fails if any of these drift:
 *
 *   1. `CoordinatedProductsComposed` is assignable to the renderer's
 *      `ComponentType<CoordinatedProductsProps>` — i.e. it accepts exactly the
 *      `{ shaped, slots, siteData }` the renderer's coordinated override point
 *      hands it. (If the renderer changed the override prop shape, this breaks.)
 *   2. A `components` object carrying `CoordinatedProducts` is assignable to the
 *      renderer's `CompositionComponentOverrides` — i.e. it is a valid override
 *      to spread into `composePage`'s `options.components` (the wiring in
 *      `app/[slug]/page.tsx`).
 *
 * This is the no-harness analog of the renderer-side
 * `renderCoordinatedProducts.test.tsx`: it does NOT assert runtime behavior
 * (that the adapters fire), only that the injection seam is type-correct. The
 * runtime behavior is exercised on the live site (manual / e2e per the G4 plan).
 *
 * Limitation: type-only. It does not run the router/refetch adapters — those are
 * validated against the live route. See the report for the explicit gap.
 */

import type { ComponentType } from "react";
import type {
  CompositionComponentOverrides,
  CoordinatedProductsProps,
} from "@hillbombcreations/site-renderer";
import CoordinatedProductsComposed from "./index";

// 1. The composed component matches the renderer's coordinated override slot.
const _overrideShape: ComponentType<CoordinatedProductsProps> =
  CoordinatedProductsComposed;

// 2. It is a valid `CompositionComponentOverrides.CoordinatedProducts`.
const _overrides: CompositionComponentOverrides = {
  CoordinatedProducts: CoordinatedProductsComposed,
};

// Reference both so the assertions are not tree-shaken away as unused.
export const __coordinatedProductsContract = {
  overrideShape: _overrideShape,
  overrides: _overrides,
} as const;
