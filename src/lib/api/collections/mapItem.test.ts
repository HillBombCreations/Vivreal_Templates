import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test"). This is
// why the pure mapping lives here and not in `./index.ts` (which is
// `server-only` and imports `next/*`, so it cannot load under plain Node).
import { toContentItem } from "./mapItem.ts";

test("toContentItem: art-directed { primary, sources[] } container → populated artDirectedSources", () => {
  const raw = {
    _id: "abc",
    objectValue: {
      title: "Sourdough",
      image: {
        primary: { currentFile: { source: "https://cdn/desktop.jpg", srcset: "https://cdn/d-800.jpg 800w" } },
        sources: [
          {
            media: "(max-width: 767px)",
            currentFile: { source: "https://cdn/mobile.jpg", srcset: "https://cdn/m-400.jpg 400w" },
          },
        ],
      },
    },
  };
  const item = toContentItem(raw, "collection");
  assert.equal(item.imageUrl, "https://cdn/desktop.jpg"); // primary resolves the bare url
  assert.deepEqual(item.artDirectedSources, [
    { media: "(max-width: 767px)", src: "https://cdn/mobile.jpg", srcSet: "https://cdn/m-400.jpg 400w" },
  ]);
});

test("toContentItem: plain single-image descriptor → artDirectedSources undefined (field omitted)", () => {
  const raw = {
    _id: "def",
    objectValue: {
      title: "Baguette",
      image: { key: "p", type: "image", currentFile: { source: "https://cdn/x.jpg" } },
    },
  };
  const item = toContentItem(raw, "collection");
  assert.equal(item.imageUrl, "https://cdn/x.jpg");
  assert.equal(item.artDirectedSources, undefined);
});

test("toContentItem: object with no image at all → artDirectedSources undefined, imageUrl undefined", () => {
  const item = toContentItem({ _id: "ghi", objectValue: { title: "No image" } }, "collection");
  assert.equal(item.imageUrl, undefined);
  assert.equal(item.artDirectedSources, undefined);
});

test("toContentItem: container under a NON-preferred field key resolves its OWN variants", () => {
  // A user schema calling the image `coverArt` — resolved by the type-based
  // scan; artDirectedSources must come from that SAME resolved field.
  const raw = {
    _id: "jkl",
    objectValue: {
      title: "Custom",
      coverArt: {
        primary: { currentFile: { source: "https://cdn/cover.jpg" } },
        sources: [{ media: "(max-width: 600px)", currentFile: { source: "https://cdn/cover-sm.jpg" } }],
      },
    },
  };
  const item = toContentItem(raw, "collection");
  assert.equal(item.imageUrl, "https://cdn/cover.jpg");
  assert.deepEqual(item.artDirectedSources, [{ media: "(max-width: 600px)", src: "https://cdn/cover-sm.jpg" }]);
});
