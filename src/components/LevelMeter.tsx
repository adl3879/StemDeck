import { useRef, useEffect } from "react";

interface LevelMeterProps {
  isPlaying: boolean;
  muted: boolean;
}

const BAR_COUNT = 8;

export function LevelMeter({ isPlaying, muted }: LevelMeterProps) {
  const rafRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying || muted) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (containerRef.current) {
        const bars = containerRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          (bars[i] as HTMLElement).style.height = "3px";
        }
      }
      return;
    }

    let tick = 0;
    const animate = () => {
      tick++;
      if (containerRef.current) {
        const bars = containerRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const seed = Math.sin(tick * 0.08 + i * 1.7) * 0.5 + 0.5;
          const noise = Math.sin(tick * 0.13 + i * 0.9) * 0.3;
          const h = Math.max(2, Math.round((seed + noise) * 14));
          (bars[i] as HTMLElement).style.height = `${h}px`;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, muted]);

  return (
    <div className="level-meter" ref={containerRef}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          className={`level-meter-bar${isPlaying && !muted ? " active" : ""}`}
          style={{ height: "3px" }}
        />
      ))}
    </div>
  );
}
