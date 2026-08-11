import { useRef, useState, useCallback, useEffect } from "react";
import type { Stem } from "../types";

interface AudioChannel {
  gainNode: GainNode | null;
  buffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  sampleRate: number;
}

interface StoredStem {
  arrayBuf: ArrayBuffer;
  sampleRate: number;
  id: string;
}

export interface WaveformData {
  peaks: number[];
  duration: number;
}

interface UseAudioEngineReturn {
  isLoading: boolean;
  isPlaying: boolean;
  speed: number;
  loadError: string | null;
  currentTime: number;
  duration: number;
  waveform: WaveformData | null;
  loadStems: (stems: Stem[]) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (stemId: string, volume: number) => void;
  setMute: (stemId: string, muted: boolean) => void;
  setSpeed: (speed: number) => void;
  dispose: () => void;
}

const WAVEFORM_RESOLUTION = 200;

function extractWaveform(entries: { buffer: Float32Array; sampleRate: number }[], duration: number): WaveformData {
  if (duration <= 0 || entries.length === 0) return { peaks: new Array(WAVEFORM_RESOLUTION).fill(0), duration };
  const peaks: number[] = [];
  const bucketSize = duration / WAVEFORM_RESOLUTION;

  for (let i = 0; i < WAVEFORM_RESOLUTION; i++) {
    const timeStart = i * bucketSize;
    const timeEnd = (i + 1) * bucketSize;
    let maxPeak = 0;
    for (const entry of entries) {
      const s = Math.floor(timeStart * entry.sampleRate);
      const e = Math.floor(timeEnd * entry.sampleRate);
      for (let j = s; j < e && j < entry.buffer.length; j++) {
        const abs = Math.abs(entry.buffer[j]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }
    peaks.push(Math.min(maxPeak * 1.2, 1));
  }
  return { peaks, duration };
}

export function useAudioEngine(): UseAudioEngineReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const channelsRef = useRef<Map<string, AudioChannel>>(new Map());
  const storedStemsRef = useRef<StoredStem[]>([]);
  const decodedRef = useRef(false);
  const startTimeRef = useRef(0);
  const seekOffsetRef = useRef(0);
  const speedRef = useRef(1);
  const volRef = useRef<Record<string, number>>({});
  const muteRef = useRef<Record<string, boolean>>({});
  const durationRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const playingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<WaveformData | null>(null);

  const tick = useCallback(() => {
    if (!ctxRef.current || !playingRef.current) return;
    const ctx = ctxRef.current;
    const elapsed = (ctx.currentTime - startTimeRef.current) * speedRef.current;
    const pos = seekOffsetRef.current + elapsed;
    setCurrentTime(Math.min(pos, durationRef.current));
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  const stopAllSources = useCallback(() => {
    channelsRef.current.forEach((ch) => {
      try { ch.sourceNode?.stop(); } catch {}
      ch.sourceNode = null;
    });
  }, []);

  const dispose = useCallback(() => {
    stopAllSources();
    channelsRef.current.forEach((ch) => {
      try { ch.gainNode?.disconnect(); } catch {}
    });
    channelsRef.current.clear();
    storedStemsRef.current = [];
    decodedRef.current = false;
    seekOffsetRef.current = 0;
    startTimeRef.current = 0;
    setIsPlaying(false);
    playingRef.current = false;
    setCurrentTime(0);
    setWaveform(null);
  }, [stopAllSources]);

  const startPlayback = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    stopAllSources();
    const now = ctx.currentTime;
    startTimeRef.current = now;
    const speedVal = speedRef.current;

    channelsRef.current.forEach((ch) => {
      if (!ch.buffer) return;
      const src = ctx.createBufferSource();
      src.buffer = ch.buffer;
      src.playbackRate.value = speedVal;
      src.connect(ch.gainNode!);
      const offset = seekOffsetRef.current / speedVal;
      if (offset < ch.buffer.duration) {
        src.start(now, offset);
      }
      ch.sourceNode = src;
    });
  }, [stopAllSources]);

  const loadStems = useCallback(
    async (stems: Stem[]): Promise<void> => {
      setIsLoading(true);
      setLoadError(null);
      dispose();

      const newStored: StoredStem[] = [];
      let maxDur = 0;

      for (const stem of stems) {
        try {
          const arrayBuf = await stem.blob.arrayBuffer();
          const offlineCtx = new OfflineAudioContext(1, 2, 44100);
          const buffer = await offlineCtx.decodeAudioData(arrayBuf.slice(0));
          newStored.push({
            arrayBuf,
            sampleRate: buffer.sampleRate,
            id: stem.id,
          });
          if (buffer.duration > maxDur) maxDur = buffer.duration;
          volRef.current[stem.id] = 1;
          muteRef.current[stem.id] = false;
        } catch (err) {
          setLoadError(`Failed to decode "${stem.name}": ${err}`);
        }
      }

      storedStemsRef.current = newStored;
      decodedRef.current = false;
      durationRef.current = maxDur;
      setDuration(maxDur);

      if (newStored.length > 0) {
        setWaveform({ peaks: new Array(WAVEFORM_RESOLUTION).fill(0.1), duration: maxDur });
      }

      setIsLoading(false);
    },
    [dispose]
  );

  const decodeAll = useCallback(async (ctx: AudioContext): Promise<void> => {
    if (decodedRef.current) return;
    const stored = storedStemsRef.current;
    if (stored.length === 0) return;

    setIsLoading(true);
    const newChannels = new Map<string, AudioChannel>();
    let maxDur = 0;
    const buffersForWaveform: { buffer: Float32Array; sampleRate: number }[] = [];

    for (const s of stored) {
      try {
        const buffer = await ctx.decodeAudioData(s.arrayBuf.slice(0));
        const gain = ctx.createGain();
        gain.gain.value = muteRef.current[s.id] ? 0 : (volRef.current[s.id] ?? 1);
        gain.connect(ctx.destination);
        newChannels.set(s.id, {
          gainNode: gain,
          buffer,
          sourceNode: null,
          sampleRate: buffer.sampleRate,
        });
        buffersForWaveform.push({ buffer: buffer.getChannelData(0), sampleRate: buffer.sampleRate });
        if (buffer.duration > maxDur) maxDur = buffer.duration;
      } catch {}
    }

    channelsRef.current = newChannels;
    durationRef.current = maxDur;
    setDuration(maxDur);
    setWaveform(extractWaveform(buffersForWaveform, maxDur));
    decodedRef.current = true;
    setIsLoading(false);
  }, []);

  const play = useCallback(async () => {
    const stored = storedStemsRef.current;
    if (stored.length === 0) return;

    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (!decodedRef.current) {
      await decodeAll(ctx);
    }

    startPlayback();
    setIsPlaying(true);
    playingRef.current = true;
    requestAnimationFrame(tick);
  }, [decodeAll, startPlayback, tick]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    seekOffsetRef.current += (ctx.currentTime - startTimeRef.current) * speedRef.current;
    startTimeRef.current = 0;
    stopAllSources();
    setIsPlaying(false);
    playingRef.current = false;
  }, [stopAllSources]);

  const stop = useCallback(() => {
    stopAllSources();
    seekOffsetRef.current = 0;
    startTimeRef.current = 0;
    setIsPlaying(false);
    playingRef.current = false;
    setCurrentTime(0);
    speedRef.current = 1;
    setSpeedState(1);
    channelsRef.current.forEach((ch) => {
      if (ch.gainNode) ch.gainNode.gain.value = 1;
    });
    volRef.current = {};
    muteRef.current = {};
  }, [stopAllSources]);

  const seek = useCallback((time: number) => {
    seekOffsetRef.current = Math.max(0, Math.min(time, durationRef.current));
    setCurrentTime(seekOffsetRef.current);
    if (playingRef.current) {
      startPlayback();
    }
  }, [startPlayback]);

  const setVolume = useCallback((stemId: string, volume: number) => {
    volRef.current[stemId] = volume;
    const ch = channelsRef.current.get(stemId);
    if (ch?.gainNode && !muteRef.current[stemId]) {
      ch.gainNode.gain.value = volume;
    }
  }, []);

  const setMute = useCallback((stemId: string, muted: boolean) => {
    muteRef.current[stemId] = muted;
    const ch = channelsRef.current.get(stemId);
    if (ch?.gainNode) {
      ch.gainNode.gain.value = muted ? 0 : (volRef.current[stemId] ?? 1);
    }
  }, []);

  const setSpeed = useCallback((s: number) => {
    const oldSpeed = speedRef.current;
    speedRef.current = s;
    setSpeedState(s);
    channelsRef.current.forEach((ch) => {
      if (ch.sourceNode) ch.sourceNode.playbackRate.value = s;
    });
    if (playingRef.current && ctxRef.current) {
      const ctx = ctxRef.current;
      const now = ctx.currentTime;
      seekOffsetRef.current += (now - startTimeRef.current) * oldSpeed;
      startTimeRef.current = now;
    }
  }, []);

  return {
    isLoading,
    isPlaying,
    speed,
    loadError,
    currentTime,
    duration,
    waveform,
    loadStems,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setMute,
    setSpeed,
    dispose,
  };
}
