#!/usr/bin/env node
/**
 * Wrapper to run Expo CLI so it always runs with Node (avoids Bun → Node ESM handoff).
 * Usage: node scripts/run-expo-cli.cjs start --tunnel
 */
const { spawnSync } = require('child_process');
const path = require('path');

const node = process.execPath;
const cliPath = path.join(__dirname, "..", "node_modules", "@expo", "cli", "build", "bin", "cli");
const args = process.argv.slice(2);
const preload = path.join(__dirname, "polyfill-readablestream.cjs");
const nodeOptions = [
  (process.env.NODE_OPTIONS || "").replace(/\b--experimental-vm-modules\b/, "").trim(),
  `--require=${preload}`,
].filter(Boolean).join(" ");

const result = spawnSync(node, [cliPath, ...args], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

process.exit(result.status ?? 1);
