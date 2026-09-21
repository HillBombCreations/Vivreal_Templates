/**
 * Blank out the comments in a TypeScript / TSX source string.
 *
 * Several suites here assert that a pattern is ABSENT from a module: that no
 * console call takes a response body, that no payment company is named in
 * shopper copy. Run against raw source, every one of those matches the comment
 * explaining that the thing was removed, and the check quietly becomes one that
 * can never pass.
 *
 * Two properties matter and both have already been got wrong once:
 *
 *  - It tracks string literals. Blanking every `//` eats the one inside
 *    `"https://"`, and an OVER-stripped source makes an absence assertion pass
 *    for the wrong reason, which is the same failure wearing a different hat.
 *  - Comment bytes become SPACES rather than disappearing, so offsets and line
 *    numbers still line up with the original.
 */

/** The escape character, built rather than written: a literal one in a heredoc or an editor payload can be decoded before it lands. */
const BACKSLASH = String.fromCharCode(92);

type ScanState = "code" | "line" | "block" | "single" | "double" | "template";

export function stripComments(src: string): string {
  const out = src.split("");
  let state: ScanState = "code";

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    const next = src[i + 1] ?? "";

    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line";
        out[i] = " ";
        out[i + 1] = " ";
        i += 1;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "block";
        out[i] = " ";
        out[i + 1] = " ";
        i += 1;
        continue;
      }
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "template";
      continue;
    }

    if (state === "line") {
      if (c === "\n") state = "code";
      else out[i] = " ";
      continue;
    }

    if (state === "block") {
      if (c === "*" && next === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        state = "code";
        i += 1;
        continue;
      }
      if (c !== "\n") out[i] = " ";
      continue;
    }

    // Inside a string literal.
    if (c === BACKSLASH) {
      i += 1;
      continue;
    }
    if (
      (state === "single" && c === "'") ||
      (state === "double" && c === '"') ||
      (state === "template" && c === "`")
    ) {
      state = "code";
    }
  }

  return out.join("");
}
