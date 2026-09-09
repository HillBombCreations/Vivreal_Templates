import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import ownerVisibleCopy from "./eslint-rules/owner-visible-copy.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // brand/voice.md, enforced instead of remembered.
    //
    // This is the rule the portal has had since task 6.10 and this repo never
    // did. Templates renders EVERY customer site, so an unenforced brand rule
    // here is the worst place in the fleet for one.
    //
    // Scope is all of `src/**` rather than components-and-app. The portal
    // learned that one the expensive way: its rule was first scoped to
    // components and app, and the four strings it had been written to catch
    // lived in `src/lib/`. A rule that cannot see the file it was written for
    // is decoration. In this repo the same reasoning applies to
    // `src/lib/contactErrorMessage.ts` and the `src/lib/api/**` empty-state
    // strings, which are copy a visitor reads.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { vivreal: { rules: { "owner-visible-copy": ownerVisibleCopy } } },
    rules: {
      "vivreal/owner-visible-copy": "error",
    },
  },
  {
    /**
     * Tests and their fixtures, exempt from the DASH check only.
     *
     * A test that pins what a stripper removes, or that feeds a customer
     * string through a renderer, cannot be written without typing the
     * character. These files ship to nobody: the visitor reads the component,
     * and if the component's copy is wrong this rule reports it there, where
     * the fix belongs.
     *
     * The exemption is deliberately narrow. The supplier, jargon and px checks
     * still run here, and all three are at zero across this repo; a blanket
     * "rule: off" would be one line shorter and would hand these files a
     * permanent pass on rules they do not break, which is how a clean check
     * quietly stops being one.
     */
    files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/__fixtures__/**"],
    rules: {
      "vivreal/owner-visible-copy": ["error", { allowLegacyDashes: true }],
    },
  },
  {
    /**
     * `_lockcensus.cjs`, a `require()`-based Node script at the repo root.
     *
     * Found by running the new rule rather than by reasoning about it: `npm run
     * lint` was ALREADY red at `main`, on this one file, for a TypeScript-only
     * rule aimed at a CommonJS script that is correct as written. That matters
     * more than it looks. A gate that is red before your change cannot enforce
     * your change: nobody reads the output, and the first person to run it
     * concludes the lint is broken rather than that the copy is. Turning the
     * rule off for the file it does not apply to is what makes the copy rule
     * above an actual gate instead of one more line in a failing run.
     */
    files: ["_lockcensus.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
