import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Song } from "../types";
import { getSong, saveSong, createStem } from "../store/db";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { ChannelStrip } from "./ChannelStrip";
import { WaveformScrubber } from "./WaveformScrubber";
import { IconPlay, IconPause, IconChevron, IconPlus } from "./icons/Icons";

export function Mixer() {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const engine = useAudioEngine();
  const [song, setSong] = useState<Song | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [mutes, setMutes] = useState<Record<string, boolean>>({});
  const [speedExpanded, setSpeedExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const loadStemsRef = useRef(engine.loadStems);
  const disposeRef = useRef(engine.dispose);
  loadStemsRef.current = engine.loadStems;
  disposeRef.current = engine.dispose;

  useEffect(() => {
    if (!songId) return;
    getSong(songId).then((s) => {
      if (s) setSong(s);
    });
  }, [songId]);

  useEffect(() => {
    if (!song || loadedRef.current) return;
    loadedRef.current = true;
    loadStemsRef.current(song.stems);
  }, [song]);

  useEffect(() => {
    if (!song) return;
    engine.setMediaMetadata(song.name);
  }, [song, engine]);

  useEffect(() => {
    return () => disposeRef.current();
  }, []);

  const handleVolume = useCallback(
    (stemId: string, vol: number) => {
      setVolumes((v) => ({ ...v, [stemId]: vol }));
      engine.setVolume(stemId, vol);
    },
    [engine]
  );

  const handleMute = useCallback(
    (stemId: string, muted: boolean) => {
      setMutes((m) => ({ ...m, [stemId]: muted }));
      engine.setMute(stemId, muted);
    },
    [engine]
  );

  const addStems = async (files: FileList) => {
    if (!song) return;
    const audioFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|flac|m4a|aac|aiff|wma)$/i.test(f.name)
    );
    if (audioFiles.length === 0) return;

    const nextIndex = song.stems.length;
    const newStems = audioFiles.map((f, i) => createStem(f, nextIndex + i));
    const updatedSong: Song = { ...song, stems: [...song.stems, ...newStems] };
    await saveSong(updatedSong);
    setSong(updatedSong);
    loadStemsRef.current(updatedSong.stems);
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
          {engine.loadError && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: "var(--coral)",
                fontSize: 13,
              }}
            >
              {engine.loadError}
            </div>
          )}
          {song.stems.map((stem) => (
            <ChannelStrip
              key={stem.id}
              stem={stem}
              volume={volumes[stem.id] ?? 1}
              muted={mutes[stem.id] ?? false}
              isPlaying={engine.isPlaying}
              onVolumeChange={(v) => handleVolume(stem.id, v)}
              onMuteToggle={() => handleMute(stem.id, !mutes[stem.id])}
            />
          ))}
        </div>

        <div className="transport">
          <WaveformScrubber
            waveform={engine.waveform}
            currentTime={engine.currentTime}
            duration={engine.duration}
            onSeek={engine.seek}
          />
          <div className="transport-row">
            <div className="transport-speed">
              <button
                className="transport-speed-readout"
                onClick={() => setSpeedExpanded((v) => !v)}
                aria-label={`Speed ${engine.speed}x. Tap to adjust.`}
              >
                {engine.speed.toFixed(2)}x
              </button>
              {speedExpanded && (
                <>
                  <input
                    type="range"
                    className="transport-speed-slider"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={engine.speed}
                    onChange={(e) => engine.setSpeed(Number(e.target.value))}
                    aria-label="Playback speed"
                  />
                  <span className="transport-speed-label">
                    {engine.speed.toFixed(2)}x
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          className="transport-play-float"
          onClick={() => {
            if (engine.isPlaying) {
              engine.pause();
            } else {
              engine.play();
            }
          }}
          aria-label={engine.isPlaying ? "Pause" : "Play"}
        >
          {engine.isPlaying ? <IconPause /> : <IconPlay />}
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
