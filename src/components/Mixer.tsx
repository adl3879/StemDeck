import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Song } from "../types";
import { getSong, saveSong, createStem } from "../store/db";
import { usePlayer } from "../store/player";
import { ChannelStrip } from "./ChannelStrip";
import { WaveformScrubber } from "./WaveformScrubber";
import { IconPlay, IconPause, IconChevron, IconPlus } from "./icons/Icons";

export function Mixer() {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const {
    volumes,
    mutes,
    isPlaying,
    loadError,
    currentTime,
    duration,
    speed,
    waveform,
    openSong,
    reloadStems,
    play,
    pause,
    seek,
    setSpeed,
    setVolume,
    setMute,
  } = usePlayer();
  const [song, setSong] = useState<Song | null>(null);
  const [speedExpanded, setSpeedExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!songId) return;
    getSong(songId).then((s) => {
      if (s) setSong(s);
    });
  }, [songId]);

  useEffect(() => {
    if (!song || loadedRef.current) return;
    loadedRef.current = true;
    openSong(song);
  }, [song, openSong]);

  const addStems = async (files: FileList) => {
    if (!song) return;
    const audioFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("audio/") ||
        /\\.(mp3|wav|ogg|flac|m4a|aac|aiff|wma)$/i.test(f.name)
    );
    if (audioFiles.length === 0) return;

    const nextIndex = song.stems.length;
    const newStems = audioFiles.map((f, i) => createStem(f, nextIndex + i));
    const updatedSong: Song = { ...song, stems: [...song.stems, ...newStems] };
    await saveSong(updatedSong);
    setSong(updatedSong);
    reloadStems(updatedSong);
  };

  if (!song) {
    return (
      <>
        <div className="header">
          <button className="btn-icon" onClick={() => navigate("/")}>
            <IconChevron />
          </button>
          <h1 className="header-title">StemDeck</h1>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header">
        <button className="btn-icon" onClick={() => navigate("/")}>
          <IconChevron />
        </button>
        <h1 className="header-title">{song.name}</h1>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => fileInputRef.current?.click()}
        >
          <IconPlus />
          <span style={{ marginLeft: 4 }}>Stems</span>
        </button>
      </div>

      <div className="mixer">
        <div className="mixer-channels">
          {loadError && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: "var(--coral)",
                fontSize: 13,
              }}
            >
              {loadError}
            </div>
          )}
          {song.stems.map((stem) => (
            <ChannelStrip
              key={stem.id}
              stem={stem}
              volume={volumes[stem.id] ?? 1}
              muted={mutes[stem.id] ?? false}
              isPlaying={isPlaying}
              onVolumeChange={(v) => setVolume(stem.id, v)}
              onMuteToggle={() => setMute(stem.id, !mutes[stem.id])}
            />
          ))}
        </div>

        <div className="transport">
          <WaveformScrubber
            waveform={waveform}
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
          />
          <div className="transport-row">
            <div className="transport-speed">
              <button
                className="transport-speed-readout"
                onClick={() => setSpeedExpanded((v) => !v)}
                aria-label={`Speed ${speed}x. Tap to adjust.`}
              >
                {speed.toFixed(2)}x
              </button>
              {speedExpanded && (
                <>
                  <input
                    type="range"
                    className="transport-speed-slider"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    aria-label="Playback speed"
                  />
                  <span className="transport-speed-label">
                    {speed.toFixed(2)}x
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          className="transport-play-float"
          onClick={() => {
            if (isPlaying) {
              pause();
            } else {
              play();
            }
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) addStems(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
