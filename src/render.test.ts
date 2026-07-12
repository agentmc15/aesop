import { test } from "node:test";
import assert from "node:assert/strict";
import { fenceDrift, mergeWithExisting, wrapInlineFence } from "./render.js";
import { sha256 } from "./registry.js";

// The fence is the product's core guarantee: generated regions are replaceable, everything the
// human wrote survives byte-for-byte. These tests pin that contract in isolation (the compile
// golden tests only exercise it end-to-end).

test("wrapInlineFence: hash matches the fenced body, trailing newline normalized", () => {
  const fenced = wrapInlineFence("# Title\n\nbody"); // no trailing newline → one is added
  const m = fenced.match(/^<!-- aesop:begin v1 sha256:([0-9a-f]{64}) -->\n([\s\S]*)<!-- aesop:end -->\n$/);
  assert.ok(m, "fence shape wrong");
  assert.equal(m![2], "# Title\n\nbody\n");
  assert.equal(sha256(m![2]!), m![1]);
});

test("fenceDrift: clean → false, tampered → true, unfenced → null", () => {
  const clean = wrapInlineFence("rules\n");
  assert.deepEqual(fenceDrift(clean), { drifted: false });
  assert.deepEqual(fenceDrift(clean.replace("rules", "edited rules")), { drifted: true });
  assert.equal(fenceDrift("# plain file, no fence\n"), null);
});

test("mergeWithExisting: no existing file → generated as-is; empty file → generated as-is", () => {
  const gen = wrapInlineFence("content\n");
  assert.equal(mergeWithExisting(gen, undefined), gen);
  assert.equal(mergeWithExisting(gen, ""), gen);
  assert.equal(mergeWithExisting(gen, "  \n\n"), gen, "whitespace-only file must not leave a preserved block");
});

test("mergeWithExisting: fence replaced, hand-written content above AND below survives byte-for-byte", () => {
  const v1 = wrapInlineFence("version one\n");
  const onDisk = `# hand-written header\n\n${v1.trimEnd()}\n\n## hand-written footer\nkeep me\n`;
  const v2 = wrapInlineFence("version two\n");
  const merged = mergeWithExisting(v2, onDisk);
  assert.ok(merged.startsWith("# hand-written header\n"), "content above the fence lost");
  assert.ok(merged.endsWith("## hand-written footer\nkeep me\n"), "content below the fence lost");
  assert.ok(merged.includes("version two"), "fenced region not replaced");
  assert.ok(!merged.includes("version one"), "old fenced region survived the merge");
  assert.deepEqual(fenceDrift(merged), { drifted: false }, "merged fence must hash clean");
});

test("mergeWithExisting: a tampered fence is still replaced wholesale (recompile repairs drift)", () => {
  const tampered = wrapInlineFence("original\n").replace("original", "user edited inside fence");
  const merged = mergeWithExisting(wrapInlineFence("regenerated\n"), tampered);
  assert.ok(merged.includes("regenerated"));
  assert.ok(!merged.includes("user edited inside fence"), "in-fence edits must not survive recompile");
  assert.deepEqual(fenceDrift(merged), { drifted: false });
});

test("mergeWithExisting: pre-existing unmanaged file lands below the preservation marker", () => {
  const merged = mergeWithExisting(wrapInlineFence("generated\n"), "# legacy rules\ndo not delete\n");
  const markerAt = merged.indexOf("aesop: pre-existing content below");
  assert.ok(markerAt > -1, "preservation marker missing");
  assert.ok(merged.indexOf("do not delete") > markerAt, "legacy content not below the marker");
  assert.ok(merged.indexOf("aesop:end") < markerAt, "generated region not on top");
  // Merging again must be stable: the preserved block is outside the fence and survives untouched.
  const again = mergeWithExisting(wrapInlineFence("generated v2\n"), merged);
  assert.equal((again.match(/aesop: pre-existing content below/g) ?? []).length, 1, "marker duplicated on remerge");
  assert.ok(again.includes("do not delete"));
});
