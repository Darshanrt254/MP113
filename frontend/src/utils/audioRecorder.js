// ─────────────────────────────────────────────────────────────────────────────
// audioRecorder.js
// Wraps the browser MediaRecorder API.
// Returns raw audio blobs in whatever format the browser supports.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick the best supported MIME type for MediaRecorder.
 * Preference: webm/opus → ogg/opus → webm → ogg → mp4 → default
 */
export function getSupportedMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return ""; // browser default
}

/**
 * Start recording from the user's microphone.
 *
 * @param {object} callbacks
 * @param {(blob: Blob) => void} callbacks.onDataAvailable  – called with each recorded chunk
 * @param {() => void}           callbacks.onStop           – called when the recorder stops
 * @returns {Promise<{ mediaRecorder: MediaRecorder, stream: MediaStream }>}
 */
export async function startRecording({ onDataAvailable, onStop }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      "Your browser does not support audio recording. Please use a modern browser such as Chrome, Edge, or Firefox."
    );
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      throw new Error(
        "Microphone access was denied. Please allow microphone access in your browser settings and try again."
      );
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      throw new Error(
        "No microphone was detected. Please connect a microphone and try again."
      );
    }
    throw new Error(`Could not access microphone: ${err.message}`);
  }

  const mimeType = getSupportedMimeType();
  const options = mimeType ? { mimeType } : {};

  let mediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (err) {
    stopStream(stream);
    throw new Error(`Could not start MediaRecorder: ${err.message}`);
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) onDataAvailable(e.data);
  };

  mediaRecorder.onstop = () => {
    stopStream(stream);
    onStop();
  };

  // Collect data every 250 ms so we get chunks even for short recordings
  mediaRecorder.start(250);

  return { mediaRecorder, stream };
}

/**
 * Stop all tracks on a MediaStream.
 */
export function stopStream(stream) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

