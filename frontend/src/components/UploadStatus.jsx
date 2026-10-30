import { CheckCircle2, XCircle, Loader2, RefreshCw, Server } from "lucide-react";

/**
 * uploadState: "idle" | "uploading" | "success" | "error"
 */
export default function UploadStatus({
  uploadState,
  httpStatus,
  responseText,
  errorMessage,
  onRetry,
}) {
  if (uploadState === "idle") return null;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 sm:p-8 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            uploadState === "uploading"
              ? "bg-blue-50 border border-blue-200"
              : uploadState === "success"
              ? "bg-teal-50 border border-teal-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {uploadState === "uploading" && (
            <Loader2 className="text-blue-600 animate-spin" size={20} />
          )}
          {uploadState === "success" && (
            <CheckCircle2 className="text-teal-600" size={20} />
          )}
          {uploadState === "error" && (
            <XCircle className="text-red-600" size={20} />
          )}
        </div>
        <div>
          <h3
            className={`text-lg font-bold ${
              uploadState === "success"
                ? "text-teal-700"
                : uploadState === "error"
                ? "text-red-700"
                : "text-slate-700"
            }`}
          >
            {uploadState === "uploading" && "Uploading Recording…"}
            {uploadState === "success" && "Upload Successful"}
            {uploadState === "error" && "Upload Failed"}
          </h3>
          <p className="text-sm text-slate-500">
            {uploadState === "uploading" &&
              "Sending MP3 to MedScribe AI. Please wait."}
            {uploadState === "success" &&
              "The recording has been sent and received by the server."}
            {uploadState === "error" &&
              "The recording could not be delivered. See details below."}
          </p>
        </div>
      </div>

      {/* Uploading – indeterminate bar */}
      {uploadState === "uploading" && (
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-teal-400 to-blue-500 rounded-full animate-pulse w-3/4" />
        </div>
      )}

      {/* HTTP status */}
      {httpStatus && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Server size={14} className="text-slate-400" />
          <span>
            HTTP Status: <strong>{httpStatus}</strong>
          </span>
        </div>
      )}

      {/* Success: server response */}
      {uploadState === "success" && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <p className="text-xs text-teal-600 font-medium uppercase tracking-wide mb-1">
            Server Response
          </p>
          <pre className="text-sm text-teal-800 whitespace-pre-wrap break-all font-mono">
            {responseText || "(empty response body)"}
          </pre>
        </div>
      )}

      {/* Error details */}
      {uploadState === "error" && errorMessage && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">
            Error Details
          </p>
          <p className="text-sm text-red-700 whitespace-pre-wrap break-words">
            {errorMessage}
          </p>
          <p className="mt-3 text-xs text-red-500 border-t border-red-200 pt-2">
            If this is a CORS or network error while testing locally, ensure n8n allows
            requests from your development origin, or deploy the app to a remote URL.
          </p>
        </div>
      )}

      {/* Retry button */}
      {uploadState === "error" && onRetry && (
        <button
          onClick={onRetry}
          className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold text-sm shadow-md hover:opacity-90 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
        >
          <RefreshCw size={16} />
          Retry Upload
        </button>
      )}
    </div>
  );
}

