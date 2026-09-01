// Builds, pushes and runs the Docker images, taking the tag from package.json.
//
// The npm scripts used to interpolate `$npm_package_version`, which cmd.exe -- npm's
// default script shell on Windows, where this repo is developed -- does not expand, so
// the tag became the literal string `$npm_package_version`, an invalid Docker reference.
// Node reads package.json the same way on every platform, and the same file feeds the
// release workflows, so a local build and a published image cannot disagree.
//
// Usage: node scripts/docker.mjs <linux|windows> <build|push|run>
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const [platform, action] = process.argv.slice(2);
if (!["linux", "windows"].includes(platform) || !["build", "push", "run"].includes(action)) {
    console.error("Usage: node scripts/docker.mjs <linux|windows> <build|push|run>");
    process.exit(1);
}

const image = `antonytm/mcp-sitecore-${platform}`;

// A prerelease must not move `latest`: `docker pull antonytm/mcp-sitecore-linux` is what
// an unpinned user gets, and it should keep resolving to the last stable release.
const tags = version.includes("-") ? [version] : [version, "latest"];

const commands = {
    build: [
        "build",
        ...tags.flatMap((tag) => ["-t", `${image}:${tag}`]),
        "--file",
        `./docker/${platform}/Dockerfile`,
        ".",
    ],
    push: null, // pushes one tag at a time, below
    run: ["run", "-it", "--rm", "-p", "4001:3001", `${image}:${version}`],
};

const run = (args) => {
    console.log(`docker ${args.join(" ")}`);
    const { status, error } = spawnSync("docker", args, { stdio: "inherit", shell: false });
    if (error) {
        console.error(error.message);
        process.exit(1);
    }
    if (status !== 0) process.exit(status ?? 1);
};

if (action === "push") {
    for (const tag of tags) run(["push", `${image}:${tag}`]);
} else {
    run(commands[action]);
}
