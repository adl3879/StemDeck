import type { Stem, StemType } from "../types";
import { getStemBorderColor } from "../hooks/useTheme";
import { LevelMeter } from "./LevelMeter";
import { IconMute, IconUnmute } from "./icons/Icons";

const STEM_ICON_SRC: Record<StemType, string> = {
  drums: "/drum.svg",
  bass: "/guitar.svg",
  vocals: "/voice.svg",
  other: "/others.svg",
};

const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1.0];

interface ChannelStripProps {
  stem: Stem;
  volume: number;
  muted: boolean;
  isPlaying: boolean;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
}

export function ChannelStrip({
  stem,
  volume,
  muted,
  isPlaying,
  onVolumeChange,
  onMuteToggle,
}: ChannelStripProps) {
  const borderColor = getStemBorderColor(stem.colorIndex);

  const currentStep = VOLUME_STEPS.reduce((best, step) =>
    Math.abs(step - volume) < Math.abs(best - volume) ? step : best, 0
  );

  const typeLabel = stem.type.charAt(0).toUpperCase() + stem.type.slice(1);

  return (
    <div className={`channel-strip${muted ? " channel-strip-muted" : ""}`} style={{ borderColor: muted ? "var(--border)" : borderColor }}>
      <div className="channel-strip-icon">
        <img src={STEM_ICON_SRC[stem.type]} alt={typeLabel} width="28" height="28" />
      </div>
      <div className="channel-strip-content">
        <div className="channel-strip-header">
          <span className="channel-strip-name">{typeLabel}</span>
          <button
            className={`channel-strip-mute${muted ? " muted" : ""}`}
            onClick={onMuteToggle}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <IconMute /> : <IconUnmute />}
          </button>
        </div>
        <LevelMeter isPlaying={isPlaying} muted={muted} />
      </div>
      <div className="channel-strip-volume-bar">
        {[...VOLUME_STEPS].reverse().map((step) => (
          <div
            key={step}
            className={`volume-step${step <= currentStep ? " active" : ""}`}
            onClick={() => onVolumeChange(step)}
          />
        ))}
      </div>
    </div>
  );
}
