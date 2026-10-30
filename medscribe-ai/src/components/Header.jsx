import { APP_NAME, APP_SUBTITLE } from "../config";
import { Activity, Mic } from "lucide-react";

export default function Header({ micActive }) {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Logo + product name */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 shadow-md">
            <Activity className="text-white" size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-none">{APP_NAME}</h1>
            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{APP_SUBTITLE}</p>
          </div>
        </div>

        {/* Right side badges */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Consultation Recorder
          </span>

          {/* Microphone status indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-300 ${
              micActive
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-slate-50 text-slate-500 border-slate-200"
            }`}
          >
            <Mic size={12} className={micActive ? "animate-pulse" : ""} />
            <span>{micActive ? "Mic Active" : "Mic Idle"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

