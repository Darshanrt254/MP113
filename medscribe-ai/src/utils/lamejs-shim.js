/**
 * lamejs-shim.js
 *
 * lame.all.js is a self-contained script that declares `function lamejs(){...}`
 * at the top level and immediately calls `lamejs()`. After the call, the
 * Mp3Encoder and WavHeader classes are attached to the `lamejs` function object.
 *
 * When Vite processes lame.all.js it wraps it in a module scope, so `lamejs`
 * is a module-level identifier — not on `window`. We capture it here by
 * evaluating the raw source and extracting the constructor.
 */

// Fetch and evaluate lame.all.js so that `lamejs` lands in our scope
import lameAllSrc from "lamejs/lame.all.js?raw";

// Create a module-scoped container for the result
let Mp3Encoder = null;
let WavHeader = null;

try {
  // Evaluate the script in a controlled way: wrap in a factory function
  // that returns the `lamejs` function after its self-call
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    `
    ${lameAllSrc}
    return lamejs;
    `
  );
  const lameNS = factory();
  Mp3Encoder = lameNS.Mp3Encoder;
  WavHeader = lameNS.WavHeader;
} catch (e) {
  console.error("Failed to initialise lamejs:", e);
}

export { Mp3Encoder, WavHeader };

