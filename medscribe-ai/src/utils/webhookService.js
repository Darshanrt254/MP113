// ─────────────────────────────────────────────────────────────────────────────
// webhookService.js
// Handles uploading an MP3 File to the configured n8n webhook.
// ─────────────────────────────────────────────────────────────────────────────

import { WEBHOOK_URL } from "../config";

/**
 * Upload an MP3 file to the n8n webhook using multipart/form-data.
 *
 * @param {File}     mp3File   – the File object containing actual MP3 bytes
 * @returns {Promise<{ status: number, text: string }>}
 */
export async function uploadToWebhook(mp3File) {
  const formData = new FormData();
  formData.append("audio", mp3File, mp3File.name);

  // NOTE: Do NOT set Content-Type manually – the browser must generate
  // the multipart boundary.
  let response;
  try {
    response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });
  } catch (networkErr) {
    // Covers: offline, DNS failure, CORS preflight rejected, etc.
    if (networkErr instanceof TypeError) {
      throw new Error(
        "Network error: Could not reach the MedScribe AI server. " +
          "Please check your internet connection or try again later. " +
          "(This may also be caused by browser CORS restrictions if testing locally.)"
      );
    }
    throw networkErr;
  }

  let responseText = "";
  try {
    responseText = await response.text();
  } catch (_) {
    responseText = "";
  }

  if (!response.ok) {
    const statusMsg = getStatusMessage(response.status);
    throw Object.assign(
      new Error(
        `Upload failed (HTTP ${response.status} – ${statusMsg}). ${
          responseText ? `Server response: ${responseText}` : ""
        }`.trim()
      ),
      { status: response.status, responseText }
    );
  }

  return { status: response.status, text: responseText };
}

function getStatusMessage(status) {
  const map = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Webhook not found – the n8n workflow may not be active",
    408: "Request Timeout",
    413: "Payload Too Large",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable – the n8n workflow may be offline",
    504: "Gateway Timeout",
  };
  return map[status] || "Server Error";
}

