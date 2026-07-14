import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test").
import { getArtDirectedSources } from "./media.ts";

// A { primary, sources[] } art-directed container as the Migrator loader emits
// and VR_Client_API signs it: each source carries its own `media` query + a
// signed currentFile.source/.srcset. There is no top-level `.key` on the
// container (each nested descriptor is signed independently).
const container = {
  primary: {
    key: "p",
    name: "photo",
    type: "image",
    currentFile: { source: "https://cdn/desktop.jpg", srcset: "https://cdn/desktop-800.jpg 800w" },
  },
  sources: [
    {
      key: "m",
      name: "photo__v0-maxwidth767",
      type: "image",
      media: "(max-width: 767px)",
      currentFile: { source: "https://cdn/mobile.jpg", srcset: "https://cdn/mobile-400.jpg 400w" },
    },
  ],
};

test("getArtDirectedSources: container with sources[] → [{ media, src, srcSet }]", () => {
  assert.deepEqual(getArtDirectedSources(container), [
    { media: "(max-width: 767px)", src: "https://cdn/mobile.jpg", srcSet: "https://cdn/mobile-400.jpg 400w" },
  ]);
});

test("getArtDirectedSources: source without srcset → { media, src } (no srcSet key)", () => {
  const field = {
    sources: [{ media: "(max-width: 767px)", currentFile: { source: "https://cdn/mobile.jpg" } }],
  };
  const out = getArtDirectedSources(field);
  assert.deepEqual(out, [{ media: "(max-width: 767px)", src: "https://cdn/mobile.jpg" }]);
  assert.equal("srcSet" in out[0], false); // omitted, not set to undefined
});

test("getArtDirectedSources: plain single descriptor (no sources) → []", () => {
  const plain = { key: "p", name: "photo", type: "image", currentFile: { source: "https://cdn/x.jpg" } };
  assert.deepEqual(getArtDirectedSources(plain), []);
});

test("getArtDirectedSources: sources present but not an array → []", () => {
  assert.deepEqual(getArtDirectedSources({ sources: "nope" }), []);
  assert.deepEqual(getArtDirectedSources({ sources: { media: "x" } }), []);
});

test("getArtDirectedSources: drops entries missing a media query", () => {
  const field = {
    sources: [
      { currentFile: { source: "https://cdn/nomedia.jpg" } }, // no media → drop
      { media: "(max-width: 767px)", currentFile: { source: "https://cdn/ok.jpg" } },
    ],
  };
  assert.deepEqual(getArtDirectedSources(field), [{ media: "(max-width: 767px)", src: "https://cdn/ok.jpg" }]);
});

test("getArtDirectedSources: drops entries missing a signed source url", () => {
  const field = {
    sources: [
      { media: "(max-width: 767px)" }, // no currentFile/source → drop
      { media: "(min-width: 768px)", currentFile: { srcset: "x 1x" } }, // srcset but no source → drop
      { media: "(max-width: 400px)", currentFile: { source: "https://cdn/ok.jpg" } },
    ],
  };
  assert.deepEqual(getArtDirectedSources(field), [{ media: "(max-width: 400px)", src: "https://cdn/ok.jpg" }]);
});

test("getArtDirectedSources: empty media string is dropped", () => {
  assert.deepEqual(getArtDirectedSources({ sources: [{ media: "", currentFile: { source: "https://cdn/x.jpg" } }] }), []);
});

test("getArtDirectedSources: skips non-object entries inside sources[]", () => {
  const field = {
    sources: [null, "x", 3, { media: "(max-width: 767px)", currentFile: { source: "https://cdn/ok.jpg" } }],
  };
  assert.deepEqual(getArtDirectedSources(field), [{ media: "(max-width: 767px)", src: "https://cdn/ok.jpg" }]);
});

test("getArtDirectedSources: non-object / null field → []", () => {
  assert.deepEqual(getArtDirectedSources(null), []);
  assert.deepEqual(getArtDirectedSources(undefined), []);
  assert.deepEqual(getArtDirectedSources("string"), []);
  assert.deepEqual(getArtDirectedSources(42), []);
});
