import { useState, useRef, useCallback, useEffect } from "react";
import Header from "./components/Header";
import RecordingCard from "./components/RecordingCard";
import AudioPreview from "./components/AudioPreview";
import UploadStatus from "./components/UploadStatus";
import { startRecording } from "./utils/audioRecorder";
import { encodeToMp3, getAudioDuration, stripId3Tags } from "./utils/mp3Encoder";
import { uploadToWebhook } from "./utils/webhookService";
import { generateTimestamp } from "./utils/formatters";

// ─── Recording state machine ─────────────────────────────────────────────────
// "ready" → "recording" → "processing" → "done"
//                                ↑ error falls back to "error"

export default function App() {
  // Recording
  const [recordingStatus, setRecordingStatus] = useState("ready"); // ready|recording|processing|done|error
  const [recordingError, setRecordingError] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  // Audio output
  const [mp3Url, setMp3Url] = useState(null);
  const [mp3File, setMp3File] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Upload
  const [uploadState, setUploadState] = useState("idle"); // idle|uploading|success|error
  const [httpStatus, setHttpStatus] = useState(null);
  const [responseText, setResponseText] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Waveform analyser
  const [analyserNode, setAnalyserNode] = useState(null);

  // Internal refs (not re-rendered on change)
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const prevMp3UrlRef = useRef(null);
  const isUploadingRef = useRef(false);
  const audioContextRef = useRef(null);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (prevMp3UrlRef.current) URL.revokeObjectURL(prevMp3UrlRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // ── Start recording ────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (recordingStatus === "recording" || recordingStatus === "processing") return;

    // Revoke old MP3 URL if re-recording
    if (prevMp3UrlRef.current) {
      URL.revokeObjectURL(prevMp3UrlRef.current);
      prevMp3UrlRef.current = null;
    }

    setRecordingError(null);
    setRecordingStatus("recording");
    setElapsed(0);
    setMp3Url(null);
    setMp3File(null);
    setUploadState("idle");
    setHttpStatus(null);
    setResponseText(null);
    setUploadError(null);
    chunksRef.current = [];

    try {
      const { mediaRecorder, stream } = await startRecording({
        onDataAvailable: (blob) => chunksRef.current.push(blob),
        onStop: () => {
          /* handled in handleStop */
        },
      });

      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;

      // ── Wire up Web Audio analyser for waveform ──────────────────────────
      try {
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        setAnalyserNode(analyser);
      } catch (_) {
        // Waveform is cosmetic – silently continue without it
        setAnalyserNode(null);
      }

      // Start timer
      timerRef.current = setInterval(
        () => setElapsed((s) => s + 1),
        1000
      );
    } catch (err) {
      setRecordingStatus("error");
      setRecordingError(err.message);
    }
  }, [recordingStatus]);

  // ── Stop recording ─────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (recordingStatus !== "recording") return;

    clearInterval(timerRef.current);
    setRecordingDuration(elapsed);
    setRecordingStatus("processing");
    setAnalyserNode(null);

    // Close AudioContext used for waveform
    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }

    // Stop the MediaRecorder and wait for all data
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      // Collect any remaining data then stop
      await new Promise((resolve) => {
        mr.addEventListener("stop", resolve, { once: true });
        mr.stop();
      });
    }

    // Stop microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const chunks = chunksRef.current;

    if (!chunks.length) {
      setRecordingStatus("error");
      setRecordingError("No audio was recorded. The recording may have been too short.");
      return;
    }

    // Determine the actual MIME type used
    const mimeType =
      mediaRecorderRef.current?.mimeType ||
      chunks[0]?.type ||
      "audio/webm";

    const rawBlob = new Blob(chunks, { type: mimeType });

    // ── Encode to real MP3 ──────────────────────────────────────────────────
    try {
      const mp3Blob = await encodeToMp3(rawBlob);
      const timestamp = generateTimestamp();
      const file = new File([mp3Blob], `consultation_${timestamp}.mp3`, {
        type: "audio/mpeg",
      });
      const url = URL.createObjectURL(mp3Blob);
      prevMp3UrlRef.current = url;

      setMp3File(file);
      setMp3Url(url);
      setRecordingStatus("done");
    } catch (err) {
      setRecordingStatus("error");
      setRecordingError(`MP3 encoding failed: ${err.message}`);
    }
  }, [recordingStatus, elapsed]);

  // ── Upload audio file directly ─────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    if (recordingStatus === "recording" || recordingStatus === "processing") return;

    // Revoke old MP3 URL if any
    if (prevMp3UrlRef.current) {
      URL.revokeObjectURL(prevMp3UrlRef.current);
      prevMp3UrlRef.current = null;
    }

    setRecordingError(null);
    setRecordingStatus("processing");
    setMp3Url(null);
    setMp3File(null);
    setUploadState("idle");
    setHttpStatus(null);
    setResponseText(null);
    setUploadError(null);

    try {
      if (file.size === 0) {
        throw new Error("The selected audio file is empty.");
      }

      const timestamp = generateTimestamp();
      let finalFile;
      let durationSec = 0;

      // Extract duration via native HTML Audio metadata
      try {
        const dur = await getAudioDuration(file);
        durationSec = Math.round(dur || 0);
      } catch (_) {
        durationSec = 0;
      }

      // Convert audio file into clean, standardized MP3 (same pipeline as live recording)
      // This strips ID3 metadata/artwork, normalizes channels, and generates compliant MP3 frames
      // that Google Gemini and n8n can transcribe without error.
      try {
        const mp3Blob = await encodeToMp3(file);
        if (mp3Blob.duration && !durationSec) {
          durationSec = Math.round(mp3Blob.duration);
        }
        finalFile = new File([mp3Blob], `consultation_${timestamp}.mp3`, {
          type: "audio/mpeg",
        });
      } catch (encodeErr) {
        // Fallback for MP3 files: strip ID3v2 tags/artwork to ensure pure MPEG frames
        const isMp3 =
          file.name.toLowerCase().endsWith(".mp3") ||
          file.type.includes("audio/mpeg") ||
          file.type.includes("audio/mp3");

        if (isMp3) {
          const rawBuffer = await file.arrayBuffer();
          const cleanBuffer = stripId3Tags(rawBuffer);
          const cleanBlob = new Blob([cleanBuffer], { type: "audio/mpeg" });
          finalFile = new File([cleanBlob], `consultation_${timestamp}.mp3`, {
            type: "audio/mpeg",
          });
        } else {
          throw encodeErr;
        }
      }

      const url = URL.createObjectURL(finalFile);
      prevMp3UrlRef.current = url;

      setMp3File(finalFile);
      setMp3Url(url);
      setRecordingDuration(durationSec);
      setElapsed(durationSec);
      setRecordingStatus("done");
    } catch (err) {
      setRecordingStatus("error");
      setRecordingError(`Audio file processing failed: ${err.message}`);
    }
  }, [recordingStatus]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!mp3File || isUploadingRef.current) return;
    isUploadingRef.current = true;

    setUploadState("uploading");
    setHttpStatus(null);
    setResponseText(null);
    setUploadError(null);

    try {
      const { status, text } = await uploadToWebhook(mp3File);
      setHttpStatus(status);
      setResponseText(text);
      setUploadState("success");
    } catch (err) {
      setHttpStatus(err.status || null);
      setUploadError(err.message);
      setUploadState("error");
    } finally {
      isUploadingRef.current = false;
    }
  }, [mp3File]);

  // ── Retry upload ───────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    handleUpload();
  }, [handleUpload]);

  // ── Record again ───────────────────────────────────────────────────────────
  const handleRecordAgain = useCallback(() => {
    if (prevMp3UrlRef.current) {
      URL.revokeObjectURL(prevMp3UrlRef.current);
      prevMp3UrlRef.current = null;
    }
    setMp3Url(null);
    setMp3File(null);
    setElapsed(0);
    setRecordingDuration(0);
    setRecordingStatus("ready");
    setRecordingError(null);
    setUploadState("idle");
    setHttpStatus(null);
    setResponseText(null);
    setUploadError(null);
  }, []);

  const micActive = recordingStatus === "recording";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/20">
      <Header micActive={micActive} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Recording card – always visible */}
        <RecordingCard
          status={recordingStatus}
          elapsed={elapsed}
          analyserNode={analyserNode}
          error={recordingError}
          onStart={handleStart}
          onStop={handleStop}
          onFileUpload={handleFileUpload}
        />

        {/* Audio preview – shown after successful encoding */}
        {recordingStatus === "done" && mp3Url && mp3File && (
          <AudioPreview
            mp3Url={mp3Url}
            mp3File={mp3File}
            duration={recordingDuration}
            isUploading={uploadState === "uploading"}
            onUpload={handleUpload}
            onRecordAgain={handleRecordAgain}
          />
        )}

        {/* Upload status */}
        <UploadStatus
          uploadState={uploadState}
          httpStatus={httpStatus}
          responseText={responseText}
          errorMessage={uploadError}
          onRetry={handleRetry}
        />
      </main>

      <footer className="text-center py-6 text-xs text-slate-400">
        MedScribe AI · Consultation Recorder · Phase 1 &mdash; Audio capture &amp; upload
      </footer>
    </div>
  );
}

