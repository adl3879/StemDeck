import { useRef, useState, useCallback, useEffect } from "react";
import type { Stem } from "../types";

interface AudioChannel {
  gainNode: GainNode;
  buffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  sampleRate: number;
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

function extractWaveform(channels: Map<string, AudioChannel>, duration: number): WaveformData {
  if (duration <= 0) return { peaks: new Array(WAVEFORM_RESOLUTION).fill(0), duration };

  const peaks: number[] = [];
  const bucketSize = duration / WAVEFORM_RESOLUTION;

  const entries: { buffer: Float32Array; sampleRate: number }[] = [];
  channels.forEach((ch) => {
    if (ch.buffer) {
      entries.push({ buffer: ch.buffer.getChannelData(0), sampleRate: ch.sampleRate });
    }
  });

  if (entries.length === 0) return { peaks: new Array(WAVEFORM_RESOLUTION).fill(0), duration };

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

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const stopAllSources = useCallback(() => {
    channelsRef.current.forEach((ch) => {
      try {
        ch.sourceNode?.stop();
      } catch {}
      ch.sourceNode = null;
    });
  }, []);

  const dispose = useCallback(() => {
    stopAllSources();
    channelsRef.current.forEach((ch) => {
      try {
        ch.gainNode.disconnect();
      } catch {}
    });
    channelsRef.current.clear();
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
      src.connect(ch.gainNode);
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

      const ctx = getCtx();
      const newChannels = new Map<string, AudioChannel>();
      let maxDur = 0;

      for (const stem of stems) {
        try {
          const arrayBuf = await stem.blob.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuf);
          const gain = ctx.createGain();
          gain.gain.value = 1;
          gain.connect(ctx.destination);
          newChannels.set(stem.id, { gainNode: gain, buffer, sourceNode: null, sampleRate: buffer.sampleRate });
          if (buffer.duration > maxDur) maxDur = buffer.duration;
          volRef.current[stem.id] = 1;
          muteRef.current[stem.id] = false;
        } catch (err) {
          setLoadError(`Failed to decode "${stem.name}": ${err}`);
        }
      }

      channelsRef.current = newChannels;
      durationRef.current = maxDur;
      setDuration(maxDur);
      setWaveform(extractWaveform(newChannels, maxDur));
      setIsLoading(false);
    },
    [getCtx, dispose]
  );

  const play = useCallback(async () => {
    if (channelsRef.current.size === 0) return;

    const ctx = getCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    startPlayback();
    setIsPlaying(true);
    playingRef.current = true;
    requestAnimationFrame(tick);
  }, [getCtx, startPlayback, tick]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    seekOffsetRef.current +=
      (ctx.currentTime - startTimeRef.current) * speedRef.current;
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
      ch.gainNode.gain.value = 1;
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
    if (ch && !muteRef.current[stemId]) {
      ch.gainNode.gain.value = volume;
    }
  }, []);

  const setMute = useCallback((stemId: string, muted: boolean) => {
    muteRef.current[stemId] = muted;
    const ch = channelsRef.current.get(stemId);
    if (ch) {
      ch.gainNode.gain.value = muted ? 0 : (volRef.current[stemId] ?? 1);
    }
  }, []);

  const setSpeed = useCallback((s: number) => {
    const oldSpeed = speedRef.current;
    speedRef.current = s;
    setSpeedState(s);

    channelsRef.current.forEach((ch) => {
      if (ch.sourceNode) {
        ch.sourceNode.playbackRate.value = s;
      }
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
