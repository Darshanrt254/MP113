import { useEffect, useRef } from "react";

/**
 * Animated audio waveform bars – driven by AnalyserNode data.
 * While not recording, renders a flat baseline.
 */
export default function Waveform({ analyserNode, isRecording }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const BAR_COUNT = 40;
    const GAP = 3;

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      let heights;

      if (isRecording && analyserNode) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        const step = Math.floor(bufferLength / BAR_COUNT);
        heights = Array.from({ length: BAR_COUNT }, (_, i) => {
          const val = dataArray[i * step] / 255;
          return Math.max(0.06, val);
        });
      } else {
        heights = Array.from({ length: BAR_COUNT }, () => 0.06);
      }

      const barWidth = (W - GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, isRecording ? "#14b8a6" : "#94a3b8");
      gradient.addColorStop(1, isRecording ? "#3b82f6" : "#cbd5e1");

      ctx.fillStyle = gradient;
      ctx.beginPath();

      heights.forEach((h, i) => {
        const barH = h * H;
        const x = i * (barWidth + GAP);
        const y = (H - barH) / 2;
        const r = Math.min(barWidth / 2, 4);
        ctx.roundRect(x, y, barWidth, barH, r);
      });

      ctx.fill();

      if (isRecording) {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={60}
      className="w-full max-w-xs"
      aria-hidden="true"
    />
  );
}

