import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envLocal = resolve(root, ".env.local");
const envBackup = resolve(root, ".env.local.deploy-bak");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

let moved = false;
try {
  if (existsSync(envLocal)) {
    renameSync(envLocal, envBackup);
    moved = true;
  }
  run("pnpm", ["exec", "opennextjs-cloudflare", "build"]);
  run("pnpm", ["exec", "opennextjs-cloudflare", "deploy", "--", "--keep-vars"]);
} finally {
  if (moved && existsSync(envBackup)) renameSync(envBackup, envLocal);
}
