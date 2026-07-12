import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfile, listProfiles, loadProfile, readProfileSource } from "./profile.js";

test("profile new: forks a builtin into .aesop/profiles/, loadable and listed as custom", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-profile-"));

  const path = createProfile("team-default", "balanced", dir);
  assert.equal(path, join(dir, ".aesop", "profiles", "team-default.yaml"));

  const text = await readFile(path, "utf8");
  assert.match(text, /^profile: team-default$/m, "profile: line not rewritten to the new name");
  assert.ok(text.includes("guardrails:"), "base profile body (comments and all) not copied");
  assert.ok(!/^profile: balanced$/m.test(text), "base profile name still present");

  const loaded = loadProfile("team-default", dir);
  assert.equal(loaded.name, "team-default");
  assert.equal(loaded.stops.max_iterations, 40, "forked profile should inherit balanced's stops");

  assert.ok(
    listProfiles(dir).some((p) => p.name === "team-default" && p.source === "custom"),
    "custom profile missing from profile list"
  );
  assert.equal(readProfileSource("team-default", dir), text, "show should resolve the custom profile");

  await rm(dir, { recursive: true, force: true });
});

test("profile new: refuses overwrite, bad names, and unknown base", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-profile-"));

  createProfile("mine", "token-lean", dir);
  assert.throws(() => createProfile("mine", "balanced", dir), /already exists/);

  assert.throws(() => createProfile("../evil", "balanced", dir), /invalid profile name/);
  assert.throws(() => createProfile("UPPER", "balanced", dir), /invalid profile name/);
  assert.throws(() => createProfile("ok-name", "../../etc/passwd", dir), /invalid profile name/);
  assert.throws(() => createProfile("ok-name", "no-such-base", dir), /unknown pathway profile/);

  await rm(dir, { recursive: true, force: true });
});
