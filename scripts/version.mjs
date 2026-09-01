// Propagates the version in package.json into server.json.
//
// The version used to live by hand in five places (package.json, package-lock.json,
// server.json twice, and the Docker tags) and drifted: the 2.0.0 merge left the release
// workflows tagging images `1.4.2`. npm keeps package-lock.json in step on its own and
// the Docker tags are now derived at build time, so package.json is the only file that
// states the version and this script carries it into the one manifest npm does not touch.
//
// Wired as the npm `version` lifecycle step, so `npm version 2.0.0` rewrites server.json
// and stages it into the same commit. Safe to run by hand at any time.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

// Patch the two values in place rather than re-serializing the parsed object: server.json
// is CRLF here and JSON.stringify would emit LF, turning a two-line change into a
// whole-file diff. server.json carries exactly two `version` keys -- the server's own and
// the npm package entry's -- so a different count means the manifest grew a field this
// script does not understand, and guessing would be worse than stopping.
const file = path.join(root, "server.json");
const raw = await readFile(file, "utf8");
const pattern = /"version":\s*"[^"]*"/g;
const found = raw.match(pattern) ?? [];
if (found.length !== 2) {
    console.error(`server.json has ${found.length} "version" fields, expected 2; not touching it.`);
    process.exit(1);
}

const next = raw.replace(pattern, `"version": ${JSON.stringify(version)}`);
if (next !== raw) {
    await writeFile(file, next);
    console.log(`server.json -> ${version}`);
} else {
    console.log(`server.json already at ${version}`);
}
