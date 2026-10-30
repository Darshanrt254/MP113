// ─────────────────────────────────────────────────────────────────────────────
// mp3Encoder.js
// Decodes an audio Blob via AudioContext, then encodes to MP3 with lamejs.
//
// lamejs/lame.all.js is a self-contained script where every internal variable
// (including MPEGMode) lives inside one function scope. The individual CJS
// source files (src/js/*.js) break when Vite processes them separately because
// MPEGMode is not imported in each file. We therefore use a shim that evaluates
// lame.all.js in one scope via new Function() and re-exports Mp3Encoder.
// ─────────────────────────────────────────────────────────────────────────────

import { Mp3Encoder } from "./lamejs-shim.js";

const MP3_BITRATE = 128; // kbps

/**
 * Encode a Blob of recorded audio into an actual MP3 Blob.
 *
 * @param {Blob}      audioBlob   – raw recorded audio (webm / ogg / etc.)
 * @param {function}  onProgress  – optional (progress: number 0–1) callback
 * @returns {Promise<Blob>}        – Blob with MIME type audio/mpeg
 */
export async function encodeToMp3(audioBlob, onProgress) {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("Recording is empty. Please record some audio before encoding.");
  }

  if (!Mp3Encoder) {
    throw new Error(
      "MP3 encoder could not be loaded. Please refresh the page and try again."
    );
  }

  // ── 1. Read the blob as an ArrayBuffer ────────────────────────────────────
  const arrayBuffer = await audioBlob.arrayBuffer();
  const cleanBuffer = stripId3Tags(arrayBuffer);

  // ── 2. Decode with AudioContext ───────────────────────────────────────────
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    try {
      // First try with ID3-stripped buffer
      audioBuffer = await audioContext.decodeAudioData(cleanBuffer.slice(0));
    } catch (cleanErr) {
      // Fallback: try original buffer in case it was another container
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch (origErr) {
        // Callback-based fallback
        audioBuffer = await new Promise((resolve, reject) => {
          audioContext.decodeAudioData(
            cleanBuffer.slice(0),
            resolve,
            () => audioContext.decodeAudioData(arrayBuffer.slice(0), resolve, reject)
          );
        });
      }
    }
  } catch (err) {
    await audioContext.close();
    throw new Error(
      `Could not decode audio data (${err?.message || "unsupported format or corrupted file"}).`
    );
  }

  const sampleRate = audioBuffer.sampleRate;
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2); // max stereo
  const isStereo = numChannels === 2;

  // ── 3. Get PCM samples (-1.0 … 1.0 floats) ───────────────────────────────
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = isStereo ? audioBuffer.getChannelData(1) : leftChannel;

  const totalSamples = leftChannel.length;

  // ── 4. Initialise lamejs encoder ──────────────────────────────────────────
  const mp3encoder = new Mp3Encoder(
    isStereo ? 2 : 1,
    sampleRate,
    MP3_BITRATE
  );

  const mp3Chunks = [];
  const CHUNK = 1152; // lamejs requires multiples of 1152

  // ── 5. Encode in chunks ───────────────────────────────────────────────────
  for (let offset = 0; offset < totalSamples; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, totalSamples);
    const size = end - offset;

    const leftInt16 = floatTo16Bit(leftChannel, offset, size);
    const rightInt16 = isStereo ? floatTo16Bit(rightChannel, offset, size) : leftInt16;

    let encoded;
    if (isStereo) {
      encoded = mp3encoder.encodeBuffer(leftInt16, rightInt16);
    } else {
      encoded = mp3encoder.encodeBuffer(leftInt16);
    }

    if (encoded.length > 0) mp3Chunks.push(new Uint8Array(encoded));

    if (onProgress) {
      onProgress(Math.min(end / totalSamples, 1));
    }
  }

  // ── 6. Flush remaining frames ─────────────────────────────────────────────
  const flushed = mp3encoder.flush();
  if (flushed.length > 0) mp3Chunks.push(new Uint8Array(flushed));

  // ── 7. Release AudioContext ───────────────────────────────────────────────
  const duration = audioBuffer.duration;
  await audioContext.close();

  if (mp3Chunks.length === 0) {
    throw new Error("MP3 encoding produced no output. The recording may be too short.");
  }

  const blob = new Blob(mp3Chunks, { type: "audio/mpeg" });
  blob.duration = duration;
  return blob;
}

/**
 * Strips ID3v2 header and metadata from an MP3 ArrayBuffer so that
 * audio decoders and speech AI models receive pure, synchronized audio frames.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {ArrayBuffer}
 */
export function stripId3Tags(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 10) return arrayBuffer;
  const bytes = new Uint8Array(arrayBuffer);

  // Check for ID3v2 header: 'ID3' (0x49, 0x44, 0x33)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const flags = bytes[5];
    const size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);

    let offset = 10 + size;
    if ((flags & 0x10) !== 0) {
      // Extended footer present (+10 bytes)
      offset += 10;
    }

    // Locate first MPEG audio frame sync word (0xFF followed by 0xEx or 0xFx)
    for (let i = offset; i < Math.min(bytes.length - 2, offset + 8192); i++) {
      if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
        return arrayBuffer.slice(i);
      }
    }

    if (offset < arrayBuffer.byteLength) {
      return arrayBuffer.slice(offset);
    }
  }

  // If not WAV, M4A, OGG, or WebM, check for leading junk before MPEG sync
  const isOtherContainer =
    (bytes[0] === 0x52 && bytes[1] === 0x49) || // RIFF
    (bytes.length > 8 && bytes[4] === 0x66 && bytes[5] === 0x74) || // ftyp
    (bytes[0] === 0x4f && bytes[1] === 0x67) || // OggS
    (bytes[0] === 0x1a && bytes[1] === 0x45); // WebM

  if (!isOtherContainer) {
    for (let i = 0; i < Math.min(bytes.length - 2, 8192); i++) {
      if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
        if (i > 0) {
          return arrayBuffer.slice(i);
        }
        break;
      }
    }
  }

  return arrayBuffer;
}

/**
 * Safely obtain duration of any audio file or blob using HTML Audio metadata.
 * Works reliably across MP3 (with ID3 tags), WAV, M4A, OGG, and WebM
 * without strict Web Audio PCM decoding constraints.
 *
 * @param {Blob|File} audioBlob
 * @returns {Promise<number>}
 */
export function getAudioElementDuration(audioBlob) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio();
      audio.preload = "metadata";
      let settled = false;

      const cleanup = () => {
        if (!settled) {
          settled = true;
          URL.revokeObjectURL(url);
        }
      };

      audio.onloadedmetadata = () => {
        const d = audio.duration;
        cleanup();
        resolve(isFinite(d) ? d : 0);
      };

      audio.onerror = () => {
        cleanup();
        resolve(0);
      };

      setTimeout(() => {
        cleanup();
        resolve(0);
      }, 3500);

      audio.src = url;
    } catch (_) {
      resolve(0);
    }
  });
}

/**
 * Decode any browser-supported audio Blob/File to determine its duration in seconds.
 *
 * @param {Blob|File} audioBlob
 * @returns {Promise<number>}
 */
export async function getAudioDuration(audioBlob) {
  // Try fast and robust HTML Audio element first
  const elemDuration = await getAudioElementDuration(audioBlob);
  if (elemDuration > 0) {
    return elemDuration;
  }

  // Fallback to AudioContext
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const audioBuffer = await new Promise((resolve, reject) => {
        audioContext.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
      });
      return audioBuffer.duration;
    } finally {
      try {
        await audioContext.close();
      } catch (_) {}
    }
  } catch (_) {
    return 0;
  }
}

/**
 * Convert a Float32Array slice into a clamped Int16Array for lamejs.
 */
function floatTo16Bit(float32Array, offset, length) {
  const int16 = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[offset + i]));
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16;
}
