import { useState, useRef } from "react";
import { Mic, MicOff, Square, Loader2, Upload, FileAudio } from "lucide-react";
import Waveform from "./Waveform";
import { formatDuration } from "../utils/formatters";

/**
 * Status labels mapped to display strings and colour classes.
 */
const STATUS_CONFIG = {
  ready:      { label: "Ready",            dot: "bg-slate-400" },
  recording:  { label: "Recording…",       dot: "bg-red-500 animate-pulse" },
  processing: { label: "Processing Audio", dot: "bg-amber-500 animate-pulse" },
  done:       { label: "Recording Complete", dot: "bg-teal-500" },
  error:      { label: "Error",            dot: "bg-red-600" },
};

export default function RecordingCard({
  status,
  elapsed,
  analyserNode,
  error,
  onStart,
  onStop,
  onFileUpload,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const isDone = status === "done";
  const isReady = status === "ready";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ready;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isRecording && !isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isRecording || isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    // Reset file input so re-selecting the same file fires onChange again
    e.target.value = "";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative bg-white rounded-2xl shadow-md border transition-all duration-200 p-6 sm:p-8 flex flex-col items-center gap-6 overflow-hidden ${
        isDragging
          ? "border-teal-500 ring-4 ring-teal-100 bg-teal-50/20"
          : "border-slate-100"
      }`}
    >
      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-teal-50/95 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center gap-3 p-6 text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 border border-teal-300 flex items-center justify-center text-teal-600 animate-bounce">
            <Upload size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-teal-900">Drop your audio file here</h3>
            <p className="text-sm text-teal-700 mt-1">
              Supports MP3, WAV, M4A, WebM, OGG, AAC, FLAC
            </p>
          </div>
        </div>
      )}

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">Record Consultation</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Record the doctor-patient conversation or upload a pre-recorded audio file.
        </p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200">
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        <span className="text-sm font-medium text-slate-600">{cfg.label}</span>
      </div>

      {/* Waveform visualiser */}
      <div className="w-full flex justify-center">
        <Waveform analyserNode={analyserNode} isRecording={isRecording} />
      </div>

      {/* Large mic button */}
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={isProcessing || isDone}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 ${
          isRecording
            ? "bg-red-500 hover:bg-red-600 focus-visible:ring-red-300 scale-105"
            : isProcessing || isDone
            ? "bg-slate-300 cursor-not-allowed"
            : "bg-gradient-to-br from-teal-500 to-blue-600 hover:scale-105 hover:shadow-xl focus-visible:ring-teal-300"
        }`}
      >
        {/* Pulse ring while recording */}
        {isRecording && (
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
        )}
        {isProcessing ? (
          <Loader2 className="text-white animate-spin" size={36} />
        ) : isRecording ? (
          <Square className="text-white fill-white" size={30} />
        ) : (
          <Mic className="text-white" size={36} strokeWidth={2} />
        )}
      </button>

      {/* Timer */}
      <div
        className={`text-4xl font-mono font-bold tabular-nums transition-colors ${
          isRecording ? "text-red-600" : "text-slate-400"
        }`}
        aria-live="polite"
      >
        {formatDuration(elapsed)}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {(isReady || status === "error") && (
          <>
            <button
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 text-white font-semibold text-sm shadow-md hover:opacity-90 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
            >
              <Mic size={16} />
              Start Recording
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full my-0.5">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                or
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Upload recorded audio file */}
            <label
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm cursor-pointer shadow-sm transition-all hover:border-slate-400 focus-within:ring-4 focus-within:ring-teal-200"
            >
              <Upload size={16} className="text-teal-600" />
              <span>Upload Audio File</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.aac,.flac"
                onChange={handleFileInputChange}
                className="sr-only"
              />
            </label>

            <p className="text-[11px] text-slate-400 text-center -mt-1">
              Supports MP3, WAV, M4A, WebM, OGG, FLAC
            </p>
          </>
        )}

        {isRecording && (
          <button
            onClick={onStop}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm shadow-md hover:bg-red-600 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
          >
            <MicOff size={16} />
            Stop Recording
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="w-full max-w-sm bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4"
        >
          <strong className="block mb-1">Error</strong>
          {error}
        </div>
      )}
    </div>
  );
}
