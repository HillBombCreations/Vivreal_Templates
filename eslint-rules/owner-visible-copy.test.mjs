/**
 * Tripwires for the copy rule.
 *
 * A lint rule is the one kind of code that can be completely broken and still
 * report a green run, because "found nothing" and "cannot see anything" look
 * identical from the outside. That is exactly how the portal's earlier copy
 * audit reported clean over 13 live violations. So the first three cases below
 * assert that the rule SEES each of the three node kinds it claims to read, and
 * the rest pin the judgement calls that were easy to get wrong.
 */
import test from 'node:test';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import rule from './owner-visible-copy.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

test('owner-visible-copy', () => {
  ruleTester.run('owner-visible-copy', rule, {
    valid: [
      // The placeholder convention this repo actually uses: a bare glyph
      // standing in for "no value here" is typography, not a sentence.
      { code: 'const cell = value ?? "—";' },
      { code: 'const cell = linked ? "yes" : "—";' },
      // A template with no interpolation is still a placeholder.
      { code: 'const cell = `—`;' },
      // Tailwind. `px-3` must never read as a pixel measurement.
      { code: 'const x = <div className="px-3 mt-2 border—" />;' },
      // Correct punctuation, which is the whole point: substitute, never delete.
      { code: 'const s = "Cookie settings. Withdraw or change your consent";' },
      { code: 'const s = "who you are (your name and employer) from your device";' },
      // A module specifier is a path, not copy. Neither is a property KEY.
      { code: 'import x from "./a—b";' },
      { code: 'const o = { "a — b": 1 };' },
      // The dash check is exempt under the option; the word checks are not.
      { code: 'const s = "a — b";', options: [{ allowLegacyDashes: true }] },
    ],
    invalid: [
      // 1. Quoted string.
      {
        code: 'const s = "essentials — delivered fast";',
        errors: [{ messageId: 'dash', data: { kind: 'em dash' } }],
      },
      // 2. JSX text. This is the case a quoted-strings-only audit misses, and
      // it is where the cookie banner's two dashes lived.
      {
        code: 'const el = <p>who you are — your name — from your device</p>;',
        errors: [{ messageId: 'dash' }],
      },
      // 3. Template literal quasi with words either side.
      {
        code: 'const s = `Recipes — ${siteName}`;',
        errors: [{ messageId: 'dash' }],
      },
      // 4. THE ONE THE PLACEHOLDER EXEMPTION USED TO SWALLOW. Between two
      // interpolations the quasi is " — " and nothing else, which is the exact
      // shape `value ?? "—"` is exempted for. It is punctuation joining two
      // rendered values, and it is how `Title — Vivreal` shipped fleet-wide.
      {
        code: 'const s = `${title} — ${siteName}`;',
        errors: [{ messageId: 'dash' }],
      },
      // 5. Same shape in a log line, three separate literals, three reports.
      {
        code: 'const s = `${a} — ${b}` + (c ? ` — ${c}` : "") + ` — ${d}`;',
        errors: [{ messageId: 'dash' }, { messageId: 'dash' }, { messageId: 'dash' }],
      },
      // 6. An en dash is banned on exactly the same terms as an em dash.
      {
        code: 'const s = "Showing 1 – 24 of 40";',
        errors: [{ messageId: 'dash', data: { kind: 'en dash' } }],
      },
      // 7. A glyph that is alone in its own node but not alone in the sentence
      // the reader sees. JSX splits a sentence across nodes; a per-node
      // exemption cannot see a sentence.
      {
        code: 'const el = <span><b>Label</b>{"—"}the rest of it</span>;',
        errors: [{ messageId: 'dash' }],
      },
      // 8. A screen-reader label is copy. Someone reads it out loud.
      {
        code: 'const el = <button aria-label="Settings — change consent" />;',
        errors: [{ messageId: 'dash' }],
      },
      // 9. Supplier names, in a position where the string is copy by
      // construction rather than by guesswork.
      {
        code: 'const el = <p>CloudFront would not accept it</p>;',
        errors: [{ messageId: 'supplier', data: { term: 'CloudFront' } }],
      },
      // 10. A size in px an owner cannot act on. `px-3` above stays valid.
      {
        code: 'const el = <img alt="at least 320px wide" />;',
        errors: [{ messageId: 'px' }],
      },
    ],
  });
});

/**
 * The report has to land on the words, not on the tag above them.
 *
 * A `JSXText` node BEGINS right after the previous tag, usually on the previous
 * line, so an unanchored report points at the wrong line AND an
 * `eslint-disable-next-line` written above the text does not cover it. Asserting
 * the line here is what stops that regressing quietly.
 */
test('a JSXText report is anchored on the line the words are on', () => {
  const tester = new RuleTester({
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });
  tester.run('owner-visible-copy', rule, {
    valid: [],
    invalid: [
      {
        code: ['const el = (', '  <p>', '    who you are — your name', '  </p>', ');'].join('\n'),
        errors: [{ messageId: 'dash', line: 3 }],
      },
    ],
  });
});
