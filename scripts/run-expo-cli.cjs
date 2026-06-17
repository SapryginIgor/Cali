#!/usr/bin/env node
/**
 * Wrapper to run Expo CLI so it always runs with Node (avoids Bun → Node ESM handoff).
 * Usage: node scripts/run-expo-cli.cjs start --tunnel
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const node = process.execPath;
const cliCandidates = [
  // Older/hoisted layout
  path.join(__dirname, "..", "node_modules", "@expo", "cli", "build", "bin", "cli"),
  // Current npm layout for Expo SDK 54
  path.join(__dirname, "..", "node_modules", "expo", "node_modules", "@expo", "cli", "build", "bin", "cli"),
];
const cliPath = cliCandidates.find((candidate) => fs.existsSync(candidate));
if (!cliPath) {
  console.error("Could not locate Expo CLI binary.");
  console.error("Checked paths:");
  for (const candidate of cliCandidates) {
    console.error(` - ${candidate}`);
  }
  process.exit(1);
}
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
