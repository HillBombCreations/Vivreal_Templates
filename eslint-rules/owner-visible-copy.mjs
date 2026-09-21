/**
 * brand/voice.md, enforced in the app that renders every customer site.
 *
 * WHY HERE, AND WHY NOW. The portal has had this rule since task 6.10. Templates
 * never did, and that gap has a receipt: PR #141's dash sweep fixed the terms
 * paragraph in `StaticPage.tsx` and walked straight past the privacy paragraph
 * eleven lines above it, and past both dashes in the cookie banner, which is the
 * single most-read string on the public site. A rule enforced by people
 * remembering is a rule that holds until the sweep gets tired.
 *
 * This file is a deliberate port of `Vivreal_Portal_Mobile/eslint-rules/
 * owner-visible-copy.mjs`. It keeps that rule's three hard-won decisions rather
 * than re-deriving them:
 *
 *   IT READS JSX TEXT. A previous copy audit in the portal read only quoted
 *   strings and reported clean over 13 live violations, because most copy is not
 *   in a string literal at all: it is the text between two tags. `JSXText` is
 *   checked here on equal footing with `Literal` and `TemplateElement`. In this
 *   repo that is what catches the cookie banner, whose two em dashes sit in the
 *   prose between a `<p>` and a `<Link>`.
 *
 *   IT DOES NOT TRY TO DETECT PROSE. That same audit filtered for "looks like a
 *   sentence" and ate real sentences doing it. There is no prose heuristic here.
 *   The dash check runs on every string it can see, and the word checks are
 *   narrowed by POSITION instead. A string is user-facing because of where it
 *   sits, which is a fact rather than a guess.
 *
 *   IT KNOWS ABOUT TAILWIND. `px` is on the banned list and `px-3` is in half
 *   the files in this repo. `className` is skipped wholesale, and `px` is
 *   matched only when attached to a number.
 *
 * ONE THING THIS FILE ADDS THAT THE PORTAL DID NOT NEED. Templates renders
 * customer data, and the renderer's convention for a missing value is a bare em
 * dash in a cell. The portal rule already exempts a string that is nothing but a
 * dash, and already corrects that exemption for a dash that is punctuation
 * inside a sentence split across JSX nodes. Both halves are carried over intact,
 * because this repo is where the placeholder convention actually lives.
 *
 * SEVERITY IS "ERROR" AND THERE IS NO OTHER OPTION. `npm run lint` here is a
 * bare `eslint`, which prints warnings and exits 0, and this repo has no
 * pre-push hook to add a threshold. It also already carries six warnings at
 * `main`. So a rule set to "warn" would print into a run that passes anyway and
 * would be buried among warnings nobody clears, which is worse than not having
 * it: the ledger would record that Templates has a copy lint while the copy
 * kept drifting. In the portal the same conclusion is reached from the opposite
 * direction, because its gate runs `--max-warnings=0`. Either way there is no
 * useful middle setting: it errors, or it is not enforcement.
 */

/** The hard rule. No exceptions, no positional narrowing, both characters. */
const DASHES = [
  ['—', 'em dash'],
  ['–', 'en dash'],
];

/**
 * Our suppliers. The site owner bought from Vivreal and has no relationship
 * with any of these. "We could not" always beats "AWS rejected".
 *
 * Stripe is deliberately absent: an owner connects Stripe themselves, so it is
 * a name they already know and chose. Square is absent for the same reason.
 */
const SUPPLIERS = [
  'AWS',
  'Amplify',
  'Route 53',
  'Cognito',
  'DynamoDB',
  'CloudFront',
];

/**
 * Words only we know. Deliberately NOT a whole jargon dictionary. `api`,
 * `token`, `config`, `sync`, `null` and `metadata` are ordinary identifiers in
 * non-user-facing strings (route segments, discriminant values, cache tags),
 * and including them unscoped produces an error count nobody reads. They are
 * still reachable through the position-scoped pass below, where a hit is
 * genuinely copy rather than a variable in disguise.
 */
const JARGON = [
  'aspect ratio',
  'total pixels',
  'registrar',
  'nameserver',
  'propagation',
  'malformed',
  'payload',
  'endpoint',
  'schema',
  'boolean',
  'MIME',
  // Widened to the rest of the standing list in `copy-standards.md`, matching
  // the portal's copy of this rule. The portal's list sat at 11 words and
  // matched none of the terms walk 2 actually found, so the lint reported clean
  // over live violations. Widening it there found 14; the same widening belongs
  // here, on the repo that renders the customer's own site.
  //
  // Still deliberately absent: `api`, `token`, `config`, `sync`, `null`,
  // `undefined`, `metadata` are ordinary identifiers in strings no one reads.
  'DNS',
  'SSL',
  'render',
  'validation',
  'unsupported',
  'exceeds',
  // Banned by name in `brand/voice.md` for owner-visible copy.
  'PWA',
  'CMS',
];

/** Only meaningful attached to a number: "320px". Never `px-3`. */
const PX = /\d\s*px\b/i;

/**
 * Attributes and property names whose value reaches a person. A string here is
 * copy by virtue of WHERE IT IS, which is why the word checks can run on it
 * without anyone guessing whether it reads like a sentence.
 */
const COPY_KEYS = new Set([
  'aria-label',
  'ariaLabel',
  'alt',
  'placeholder',
  'title',
  'label',
  'sub',
  'caption',
  'description',
  'message',
  'hint',
  'helperText',
  'error',
  'errorText',
  'emptyText',
  'confirmLabel',
  'cancelLabel',
]);

/** Never copy: layout, test hooks, identifiers, module paths. */
const SKIP_ATTRS = new Set([
  'className',
  'class',
  'style',
  'key',
  'id',
  'href',
  'src',
  'type',
  'name',
]);

/** Is this string the value of an attribute that never holds copy? */
function isSkippedAttribute(node) {
  let cur = node.parent;
  for (let depth = 0; cur && depth < 4; depth += 1, cur = cur.parent) {
    if (cur.type === 'JSXAttribute') {
      const attr = cur.name?.name ?? '';
      return SKIP_ATTRS.has(attr) || attr.startsWith('data-');
    }
  }
  return false;
}

/** A property KEY, a module specifier or a type literal, rather than a value. */
function isNonCopyPosition(node) {
  const p = node.parent;
  if (!p) return false;
  if (
    p.type === 'ImportDeclaration' ||
    p.type === 'ExportNamedDeclaration' ||
    p.type === 'ExportAllDeclaration' ||
    p.type === 'ImportExpression'
  ) {
    return true;
  }
  if (p.type === 'Property' && p.key === node && !p.computed) return true;
  if (p.type === 'TSLiteralType' || p.type === 'TSEnumMember') return true;
  return false;
}

/** The nearest attribute or property name this string is the value of. */
function copyKeyOf(node) {
  let cur = node.parent;
  for (let depth = 0; cur && depth < 4; depth += 1, cur = cur.parent) {
    if (cur.type === 'JSXAttribute') return cur.name?.name ?? null;
    if (cur.type === 'Property' && cur.key) return cur.key.name ?? cur.key.value ?? null;
  }
  return null;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'User-facing copy follows brand/voice.md: no em or en dashes, no supplier names, no words only we know.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          /**
           * Exempts the DASH check only, for a file that must hold the
           * character to do its job: a stripper's own character class, a test
           * that pins what the stripper removes.
           *
           * A blanket "rule: off" for those files would have been one line
           * shorter and wrong: it would exempt them from the supplier and
           * jargon checks too, and those are currently at ZERO across this
           * codebase. Handing files a permanent exemption from a rule they do
           * not violate is how a clean check quietly stops being one.
           */
          allowLegacyDashes: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      dash: 'Copy contains an {{kind}}. brand/voice.md forbids both with no exceptions: use a comma, a period, or parentheses. Substitute the punctuation, do not just delete the character, or the sentence reads as broken to the visitor.',
      supplier:
        'Copy names "{{term}}", which is our supplier and not the owner\'s problem. Say what WE could not do instead.',
      jargon: 'Copy uses "{{term}}", a word an owner would not use. Say what they can see or do.',
      px: 'Copy states a size in px. An owner cannot compare a photo to a pixel count: say too large or too small, and what to try instead.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const allowLegacyDashes = context.options?.[0]?.allowLegacyDashes === true;

    /**
     * Where to point the report.
     *
     * A `JSXText` node BEGINS at the character right after the previous tag or
     * expression container, which is usually a newline: its `loc.start.line` is
     * the line of the thing before it, not the line the words are on. That is
     * wrong twice over. The error points at the wrong line, and an
     * `eslint-disable-next-line` written above the text does not cover it,
     * because the node already starts on the commented line. Found in the
     * portal the first time a real disable comment was written against this
     * rule and silently did nothing.
     *
     * So reports are anchored at the first non-whitespace character.
     */
    function reportLoc(node, text) {
      if (node.type !== 'JSXText') return node.loc;
      const lead = text.length - text.trimStart().length;
      const start = sourceCode.getIndexFromLoc(node.loc.start) + lead;
      return { start: sourceCode.getLocFromIndex(start), end: node.loc.end };
    }

    function checkDashes(node, text) {
      /**
       * A string that is NOTHING BUT a dash is an empty-value marker, not
       * prose: `value ?? '—'` in a spec row, `linked ? '✓' : '—'` in a summary.
       * This repo renders customer data, so that convention is load-bearing
       * here in a way it never was in the portal.
       *
       * `brand/voice.md` bans the em dash because it is "the single biggest
       * tell of machine-written copy". A glyph standing in for "nothing here"
       * is a typographic convention, not a sentence, and flagging it is how a
       * rule earns the reputation that gets it switched off. The ban still
       * applies the moment there is a word next to it.
       */
      if (/^[\s—–-]+$/.test(text) && !isSentenceInternalGlyph(node)) return;

      for (const [ch, kind] of DASHES) {
        if (text.includes(ch)) {
          context.report({ loc: reportLoc(node, text), messageId: 'dash', data: { kind } });
          return;
        }
      }
    }

    /**
     * Does this rendered glyph have a word next to it after all?
     *
     * The exemption above is correct for `value ?? '—'` in a table cell and
     * wrong for `<span><b>Label</b> {"—"} the rest of the sentence.</span>`,
     * which is the same em dash `brand/voice.md` bans, written as an escape.
     * Five of those shipped on the portal's tier-select page and its rule
     * reported the file clean, because JSX SPLITS A SENTENCE ACROSS NODES and a
     * per-node exemption cannot see a sentence.
     *
     * The `&mdash;` escape is not what hid it. The rule reads `node.value`, so
     * the escape was already decoded to the character; what hid it is that the
     * decoded value is a dash and NOTHING ELSE, which is exactly the shape the
     * placeholder exemption was written to let through.
     *
     * So the test is not "is this string only a dash" but "is this dash alone
     * in what the reader sees". A dash that is the whole expression of a JSX
     * container, inside an element that renders other text, is punctuation. A
     * dash reached through a `??` or a ternary is a placeholder, and its parent
     * is that expression rather than the container, so it stays exempt.
     */
    function rendersText(node) {
      if (!node) return false;
      if (node.type === 'JSXText') return node.value.trim().length > 0;
      if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
        return node.children.some(rendersText);
      }
      return false;
    }

    function isSentenceInternalGlyph(node) {
      /**
       * The template-literal half, which the portal never needed and this repo
       * does. In `` `${title} — ${siteName}` `` the quasi between the two
       * interpolations is the string " — " and NOTHING ELSE, which is the exact
       * shape the placeholder exemption above was written to let through. That
       * is the `Recipes — Vivreal` title builder: a dash joining two rendered
       * values, shipped to every page's `og:description` fleet-wide, and
       * invisible to a rule that only asks whether the string is a bare dash.
       *
       * A real placeholder is reached through `??` or a ternary and is a
       * `Literal`, never a `TemplateElement`. A `TemplateElement` sitting in a
       * template that interpolates anything is joining values, so it is
       * punctuation by construction. A template with no expressions at all
       * (`` `—` ``) is still a placeholder and stays exempt.
       */
      if (node.type === 'TemplateElement') {
        const literal = node.parent;
        return literal?.type === 'TemplateLiteral' && literal.expressions.length > 0;
      }

      /**
       * The JSXText half, which the expression-container test below cannot
       * reach. `Showing {from}–{to} of {n} products` puts the en dash in a
       * JSXText node of its own, whose value is the dash plus the indentation
       * that follows it. That is character for character the placeholder shape,
       * and the node's parent is the ELEMENT rather than an expression
       * container, so the test below returns false and the exemption swallows a
       * dash a shopper reads on every products page.
       *
       * A JSXText node is never reached through `??` or a ternary. It is
       * literally the text between two tags, so it is never a placeholder in
       * the sense the exemption means. The same question still decides it: is
       * the dash alone in what the reader sees, or is there a word beside it.
       *
       * Found by control rather than by reading: the en dash above sat in a
       * live products page while `npm run lint` reported the file clean.
       */
      if (node.type === 'JSXText') {
        const parent = node.parent;
        if (!parent || (parent.type !== 'JSXElement' && parent.type !== 'JSXFragment')) {
          return false;
        }
        return parent.children.some((child) => child !== node && rendersText(child));
      }

      const container = node.parent;
      if (!container || container.type !== 'JSXExpressionContainer') return false;
      // The dash must be the WHOLE expression. `value ?? '—'` fails here,
      // which is the case the exemption exists for.
      if (container.expression !== node) return false;

      const element = container.parent;
      if (!element || (element.type !== 'JSXElement' && element.type !== 'JSXFragment')) return false;

      return element.children.some((child) => child !== container && rendersText(child));
    }

    function checkWords(node, text) {
      for (const term of SUPPLIERS) {
        // Word-bounded, so `Lambda` cannot fire on `lambdaHandler` and a
        // supplier name cannot hide inside a longer identifier.
        if (new RegExp(`\\b${term.replace(/ /g, '\\s')}\\b`).test(text)) {
          context.report({ loc: reportLoc(node, text), messageId: 'supplier', data: { term } });
          return;
        }
      }
      for (const term of JARGON) {
        if (new RegExp(`\\b${term.replace(/ /g, '\\s')}\\b`, 'i').test(text)) {
          context.report({ loc: reportLoc(node, text), messageId: 'jargon', data: { term } });
          return;
        }
      }
      if (PX.test(text)) context.report({ loc: reportLoc(node, text), messageId: 'px' });
    }

    function visit(node, text) {
      if (!text || !text.trim()) return;
      if (isNonCopyPosition(node)) return;
      if (isSkippedAttribute(node)) return;
      // The hard rule runs on everything that survives the position filters,
      // except in the files the config exempts by name.
      if (!allowLegacyDashes) checkDashes(node, text);
      // The word rules run only where the string is copy by construction.
      const key = copyKeyOf(node);
      if (node.type === 'JSXText' || (key && COPY_KEYS.has(key))) checkWords(node, text);
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') visit(node, node.value);
      },
      TemplateElement(node) {
        visit(node, node.value.cooked ?? node.value.raw ?? '');
      },
      JSXText(node) {
        visit(node, node.value);
      },
    };
  },
};

export default rule;
