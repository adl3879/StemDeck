import { createContext, useContext, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Song, Volumes, Mutes } from "../types";
import { useAudioEngine } from "../hooks/useAudioEngine";
import type { WaveformData } from "../hooks/useAudioEngine";

interface CurrentSongInfo {
  id: string;
  name: string;
}

interface PlayerContextValue {
  currentSong: CurrentSongInfo | null;
  isPlaying: boolean;
  isLoading: boolean;
  loadError: string | null;
  currentTime: number;
  duration: number;
  speed: number;
  waveform: WaveformData | null;
  volumes: Volumes;
  mutes: Mutes;
  openSong: (song: Song) => Promise<void>;
  playSong: (song: Song) => Promise<void>;
  reloadStems: (song: Song) => void;
  closeSong: () => void;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setVolume: (stemId: string, volume: number) => void;
  setMute: (stemId: string, muted: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const engine = useAudioEngine();
  const {
    loadStems,
    primeContext,
    setMediaMetadata,
    stop,
    dispose,
    play,
    pause,
    seek,
    setSpeed,
    setVolume: engineSetVolume,
    setMute: engineSetMute,
    isPlaying,
    isLoading,
    loadError,
    currentTime,
    duration,
    speed,
    waveform,
  } = engine;

  const [currentSong, setCurrentSong] = useState<CurrentSongInfo | null>(null);
  const currentSongRef = useRef<CurrentSongInfo | null>(null);
  const loadTokenRef = useRef(0);
  const [volumes, setVolumes] = useState<Volumes>({});
  const [mutes, setMutes] = useState<Mutes>({});

  const openSong = useCallback(
    (song: Song): Promise<void> => {
      // Publish now-playing info early; iOS needs an active media session set up
      // around the user gesture for background audio to keep playing.
      setMediaMetadata(song.name);
      if (currentSongRef.current?.id === song.id) return Promise.resolve();
      const token = ++loadTokenRef.current;
      return loadStems(song.stems).then(() => {
        if (token !== loadTokenRef.current) return;
        const info = { id: song.id, name: song.name };
        currentSongRef.current = info;
        setCurrentSong(info);
        setVolumes({});
        setMutes({});
      });
    },
    [loadStems, setMediaMetadata]
  );

  const playSong = useCallback(
    (song: Song): Promise<void> => {
      // Set up the media session and create/resume the AudioContext synchronously
      // within the user gesture so iOS keeps audio alive in the background while
      // stems are still being decoded asynchronously.
      setMediaMetadata(song.name);
      void primeContext();
      if (currentSongRef.current?.id === song.id) return play();
      const token = ++loadTokenRef.current;
      return loadStems(song.stems).then(() => {
        if (token !== loadTokenRef.current) return;
        const info = { id: song.id, name: song.name };
        currentSongRef.current = info;
        setCurrentSong(info);
        setVolumes({});
        setMutes({});
        return play();
      });
    },
    [loadStems, setMediaMetadata, play, primeContext]
  );

  const reloadStems = useCallback(
    (song: Song) => {
      const token = ++loadTokenRef.current;
      void loadStems(song.stems).then(() => {
        if (token !== loadTokenRef.current) return;
        const info = { id: song.id, name: song.name };
        currentSongRef.current = info;
        setCurrentSong(info);
        setVolumes({});
        setMutes({});
      });
    },
    [loadStems]
  );

  const closeSong = useCallback(() => {
    loadTokenRef.current++;
    stop();
    dispose();
    currentSongRef.current = null;
    setCurrentSong(null);
    setVolumes({});
    setMutes({});
  }, [stop, dispose]);

  const handleVolume = useCallback(
    (stemId: string, volume: number) => {
      setVolumes((v) => ({ ...v, [stemId]: volume }));
      engineSetVolume(stemId, volume);
    },
    [engineSetVolume]
  );

  const handleMute = useCallback(
    (stemId: string, muted: boolean) => {
      setMutes((m) => ({ ...m, [stemId]: muted }));
      engineSetMute(stemId, muted);
    },
    [engineSetMute]
  );

  const value: PlayerContextValue = {
    currentSong,
    isPlaying,
    isLoading,
    loadError,
    currentTime,
    duration,
    speed,
    waveform,
    volumes,
    mutes,
    openSong,
    playSong,
    reloadStems,
    closeSong,
    play,
    pause,
    seek,
    setSpeed,
    setVolume: handleVolume,
    setMute: handleMute,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
