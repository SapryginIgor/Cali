/**
 * Polyfills for Node 18 so Expo CLI and Metro work (they expect Node 20+ APIs).
 * - Web Streams (ReadableStream, etc.) for undici
 * - Array.prototype.toReversed for metro-config
 */

// #region agent log
fetch('http://127.0.0.1:7242/ingest/38e64c63-ae9b-4c27-b7b1-c81644102353',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'polyfill-readablestream.cjs:6',message:'Polyfill script loaded',data:{nodeVersion:process.version,hasReadableStream:typeof global.ReadableStream !== 'undefined'},timestamp:Date.now(),runId:'initial',hypothesisId:'A'})}).catch(()=>{});
// #endregion

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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/38e64c63-ae9b-4c27-b7b1-c81644102353',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'polyfill-readablestream.cjs:16',message:'Polyfill succeeded via stream/web',data:{hasReadableStream:typeof global.ReadableStream !== 'undefined'},timestamp:Date.now(),runId:'initial',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
} catch (err) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/38e64c63-ae9b-4c27-b7b1-c81644102353',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'polyfill-readablestream.cjs:20',message:'Polyfill failed - stream/web not available',data:{error:err.message,nodeVersion:process.version,hasReadableStream:typeof global.ReadableStream !== 'undefined'},timestamp:Date.now(),runId:'initial',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Node too old or no stream/web; try web-streams-polyfill as fallback
  try {
    const { ReadableStream, TransformStream, WritableStream } = require("web-streams-polyfill/ponyfill/es2018");
    if (typeof global.ReadableStream === "undefined") global.ReadableStream = ReadableStream;
    if (typeof global.TransformStream === "undefined") global.TransformStream = TransformStream;
    if (typeof global.WritableStream === "undefined") global.WritableStream = WritableStream;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/38e64c63-ae9b-4c27-b7b1-c81644102353',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'polyfill-readablestream.cjs:28',message:'Polyfill succeeded via web-streams-polyfill',data:{hasReadableStream:typeof global.ReadableStream !== 'undefined'},timestamp:Date.now(),runId:'initial',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (polyfillErr) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/38e64c63-ae9b-4c27-b7b1-c81644102353',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'polyfill-readablestream.cjs:32',message:'All polyfill attempts failed',data:{streamWebError:err.message,polyfillError:polyfillErr.message},timestamp:Date.now(),runId:'initial',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // User should upgrade to Node 18+ or install web-streams-polyfill
  }
}
