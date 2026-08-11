import { useRef, useState, useCallback } from "react";
import type { WaveformData } from "../hooks/useAudioEngine";

const PLACEHOLDER_PEAKS = Array.from({ length: 200 }, () => 0.08 + Math.random() * 0.06);

interface WaveformScrubberProps {
  waveform: WaveformData | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function WaveformScrubber({
  waveform,
  currentTime,
  duration,
  onSeek,
}: WaveformScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      if (!containerRef.current || duration <= 0) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onSeek(getTimeFromEvent(e.clientX));
    },
    [onSeek, getTimeFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      onSeek(getTimeFromEvent(e.clientX));
    },
    [dragging, onSeek, getTimeFromEvent]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const loaded = waveform !== null && waveform.peaks.length > 0;
  const peaks = loaded ? waveform.peaks : PLACEHOLDER_PEAKS;
  const barCount = peaks.length;
  const progress = duration > 0 ? currentTime / duration : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`waveform-scrubber${!loaded ? " waveform-placeholder" : ""}`}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
    >
      <span className="waveform-time-left">{formatTime(currentTime)}</span>
      <span className="waveform-time-right">{formatTime(duration)}</span>
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        className="waveform-svg"
      >
        {peaks.map((peak, i) => {
          const isPlayed = loaded && i / barCount <= progress;
          const barW = 100 / barCount;
          const x = i * barW;
          const h = 2 + peak * 28;
          const y = 16 - h / 2;
          return (
            <rect
              key={i}
              x={x + 0.3}
              y={y}
              width={Math.max(0.4, barW - 0.6)}
              height={h}
              rx={0.3}
              fill={
                loaded
                  ? isPlayed
                    ? "var(--iris)"
                    : "var(--border)"
                  : "var(--border)"
              }
              opacity={loaded ? 1 : 0.5}
            />
          );
        })}
        {loaded && (
          <line
            x1={`${progress * 100}%`}
            y1="0"
            x2={`${progress * 100}%`}
            y2="32"
            stroke="var(--text)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}
