/**
 * Polyfills for Node 18 so Expo CLI and Metro work (they expect Node 20+ APIs).
 * - Web Streams (ReadableStream, etc.) for undici
 * - Array.prototype.toReversed for metro-config
 */
if (typeof Array.prototype.toReversed !== "function") {
  Array.prototype.toReversed = function () {
    return this.slice().reverse();
  };
}
try {
  const streamWeb = require("stream/web");
  if (typeof global.ReadableStream === "undefined") global.ReadableStream = streamWeb.ReadableStream;
  if (typeof global.TransformStream === "undefined") global.TransformStream = streamWeb.TransformStream;
  if (typeof global.WritableStream === "undefined") global.WritableStream = streamWeb.WritableStream;
} catch (_) {
  // Node too old or no stream/web; user should upgrade to Node 18+
}
