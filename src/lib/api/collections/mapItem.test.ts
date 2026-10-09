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

test("toContentItem: objectValue.link → href (item-authored card link)", () => {
  const item = toContentItem(
    { _id: "l1", objectValue: { title: "Weddings", link: "/denver-co-weddings" } },
    "collection",
  );
  assert.equal(item.href, "/denver-co-weddings");
});

test("toContentItem: objectValue.url → href; link wins over url when both present", () => {
  const urlOnly = toContentItem(
    { _id: "l2", objectValue: { name: "A Vendor", url: "https://vendor.example.com" } },
    "collection",
  );
  assert.equal(urlOnly.href, "https://vendor.example.com");

  const both = toContentItem(
    { _id: "l3", objectValue: { title: "Both", link: "/internal", url: "https://external.example.com" } },
    "collection",
  );
  assert.equal(both.href, "/internal");
});

test("toContentItem: no link/url, blank strings, or non-string values → href undefined", () => {
  assert.equal(toContentItem({ _id: "l4", objectValue: { title: "Plain" } }, "collection").href, undefined);
  assert.equal(toContentItem({ _id: "l5", objectValue: { title: "Blank", url: "  " } }, "collection").href, undefined);
  // a media descriptor object under `url` must never become href
  assert.equal(
    toContentItem({ _id: "l6", objectValue: { title: "Media", url: { currentFile: { source: "https://cdn/x.jpg" } } } }, "collection").href,
    undefined,
  );
});

// Contract C12 (OW7): a help row's video fields are media, but never a picture.
const media = (source: string) => ({ currentFile: { source } });

test("REFUSE (C12): a row with only video fields gets no imageUrl from them", () => {
  const item = toContentItem(
    {
      _id: "row1",
      objectValue: {
        title: "Step 1",
        video: media("https://media.vivreal.io/a-402.mp4"),
        videoDesktop: media("https://media.vivreal.io/a-1440.mp4"),
        videoCaptions: media("https://media.vivreal.io/a.vtt"),
      },
    },
    "collection",
  );
  assert.equal(item.imageUrl, undefined);
});

test("ALLOW (C12): a row with an image and a video still gets its image", () => {
  const item = toContentItem(
    {
      _id: "row2",
      objectValue: {
        title: "Step 2",
        video: media("https://media.vivreal.io/b-402.mp4"),
        image: media("https://media.vivreal.io/b.jpg"),
      },
    },
    "collection",
  );
  assert.equal(item.imageUrl, "https://media.vivreal.io/b.jpg");
});

test("ALLOW (C12): an image under any other field name is still found after a video", () => {
  const item = toContentItem(
    { _id: "row3", objectValue: { video: media("https://media.vivreal.io/c.mp4"), coverArt: media("https://media.vivreal.io/c.jpg") } },
    "collection",
  );
  assert.equal(item.imageUrl, "https://media.vivreal.io/c.jpg");
});
