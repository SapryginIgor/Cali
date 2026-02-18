// Polyfill for os.availableParallelism() (Node.js < 18.13.0)
const os = require("os");
if (typeof os.availableParallelism !== "function") {
  os.availableParallelism = () => os.cpus().length;
}

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
