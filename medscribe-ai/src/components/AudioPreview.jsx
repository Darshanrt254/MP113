import { useRef } from "react";
import { Download, RefreshCw, Send, Music, Clock, HardDrive } from "lucide-react";
import { formatDuration, formatBytes } from "../utils/formatters";

export default function AudioPreview({
  mp3Url,
  mp3File,
  duration,
  isUploading,
  onUpload,
  onRecordAgain,
}) {
  const audioRef = useRef(null);

  if (!mp3Url || !mp3File) return null;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 sm:p-8 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
          <Music className="text-teal-600" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Consultation Audio Ready</h3>
          <p className="text-sm text-slate-500">Review and send to MedScribe AI</p>
        </div>
      </div>

      {/* File meta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetaItem icon={<Music size={14} />} label="File" value={mp3File.name} truncate />
        <MetaItem
          icon={<Clock size={14} />}
          label="Duration"
          value={formatDuration(duration)}
        />
        <MetaItem
          icon={<HardDrive size={14} />}
          label="Size"
          value={formatBytes(mp3File.size)}
        />
      </div>

      {/* Audio player */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
          Playback Preview
        </p>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={audioRef}
          src={mp3Url}
          controls
          className="w-full"
          aria-label="Recorded consultation audio"
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Download */}
        <a
          href={mp3Url}
          download={mp3File.name}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-teal-500 text-teal-600 font-semibold text-sm hover:bg-teal-50 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
        >
          <Download size={16} />
          Download MP3
        </a>

        {/* Record / Upload again */}
        <button
          onClick={onRecordAgain}
          disabled={isUploading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          <RefreshCw size={16} />
          Record / Upload Again
        </button>

        {/* Upload */}
        <button
          onClick={onUpload}
          disabled={isUploading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 text-white font-semibold text-sm shadow-md hover:opacity-90 transition-all disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <Send size={16} />
              Send to MedScribe AI
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value, truncate }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={`text-sm font-semibold text-slate-700 ${truncate ? "truncate" : ""}`}
        title={truncate ? value : undefined}
      >
        {value}
      </p>
    </div>
  );
}

