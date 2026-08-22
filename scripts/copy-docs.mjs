// Copies the bundled SPE command reference into dist, preserving its category folders.
//
// `tsc` emits only JavaScript, so without this the loose build (`npm run build`, then
// `node dist/index.js` — which is what `npm run start:stdio` does) has no markdown to read
// and `get-powershell-documentation` fails. The rollup bundle copies the same tree for the
// published `bin`; this makes the loose build self-sufficient rather than dependent on a
// previous `npm run bundle` having left files behind.
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "src", "tools", "powershell", "documentation");
const to = path.join(root, "dist", "tools", "powershell", "documentation");

// Clear the destination first: `cp` overwrites but never deletes, so a page removed from
// the source would linger in dist forever and keep showing up in the generated index.
await rm(to, { recursive: true, force: true });
await mkdir(path.dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.error(`copied SPE command reference -> ${path.relative(root, to)}`);
