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
  primeContext: () => Promise<boolean>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (stemId: string, volume: number) => void;
  setMute: (stemId: string, muted: boolean) => void;
  setSpeed: (speed: number) => void;
  setMediaMetadata: (title: string) => void;
  dispose: () => void;
}

const WAVEFORM_RESOLUTION = 200;

// A tiny silent WAV used by the background-audio keep-alive <audio> element.
// iOS Safari only keeps Web Audio playing in the background when the page also
// holds an active media session; a looping silent audio element makes the
// browser treat the tab as a media player and keeps the audio session alive.
let silentAudioUrl: string | null = null;
function getSilentAudioUrl(): string {
  if (silentAudioUrl) return silentAudioUrl;
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second of silence, 8-bit mono PCM
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples, true);
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128);
  silentAudioUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silentAudioUrl;
}

function setMediaPlaybackState(state: "playing" | "paused") {
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }
}

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
  const loadTokenRef = useRef(0);
  const volRef = useRef<Record<string, number>>({});
  const muteRef = useRef<Record<string, boolean>>({});
  const durationRef = useRef(0);
  const keepAliveRef = useRef<HTMLAudioElement | null>(null);

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

  // The keep-alive element must start playing inside the user gesture, so it is
  // primed synchronously from primeContext (which play/playSong call on tap).
  const primeKeepAlive = useCallback(() => {
    try {
      let audio = keepAliveRef.current;
      if (!audio) {
        audio = new Audio();
        audio.src = getSilentAudioUrl();
        audio.loop = true;
        audio.volume = 0.0001;
        audio.preload = "auto";
        // Detached audio elements don't play on iOS Safari — it must be in the DOM.
        if (document.body) document.body.appendChild(audio);
        keepAliveRef.current = audio;
      }
      if (audio.paused) {
        void audio.play().catch(() => {});
      }
    } catch {}
  }, []);

  const pauseKeepAlive = useCallback(() => {
    try {
      keepAliveRef.current?.pause();
    } catch {}
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
    pauseKeepAlive();
    setMediaPlaybackState("paused");
  }, [stopAllSources, pauseKeepAlive]);

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
      const token = ++loadTokenRef.current;
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

      if (token !== loadTokenRef.current) return; // superseded by a newer load

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
      } catch (err) {
        setLoadError(`Failed to decode audio track: ${err}`);
      }
    }

    channelsRef.current = newChannels;
    durationRef.current = maxDur;
    setDuration(maxDur);
    setWaveform(extractWaveform(buffersForWaveform, maxDur));
    decodedRef.current = true;
    setIsLoading(false);
  }, []);

  const primeContext = useCallback(async (): Promise<boolean> => {
    // Start the keep-alive before any await so it runs inside the gesture.
    primeKeepAlive();
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      ctxRef.current = ctx;
    }

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }

    const silence = ctx.createBuffer(1, 1, ctx.sampleRate);
    const primeSrc = ctx.createBufferSource();
    primeSrc.buffer = silence;
    primeSrc.connect(ctx.destination);
    primeSrc.start(0);

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {}
    }

    return ctx.state === "running";
  }, []);

  const play = useCallback(async () => {
    const stored = storedStemsRef.current;
    if (stored.length === 0) return;

    const running = await primeContext();
    if (!running) {
      setLoadError("Audio blocked. Turn off silent mode and tap play again.");
      return;
    }

    const ctx = ctxRef.current!;

    if (!decodedRef.current) {
      try {
        await decodeAll(ctx);
      } catch (err) {
        setLoadError(`Failed to decode audio: ${err}`);
        return;
      }
    }

    if (channelsRef.current.size === 0) {
      setLoadError("No audio stems loaded.");
      return;
    }

    startPlayback();
    setIsPlaying(true);
    playingRef.current = true;
    setMediaPlaybackState("playing");
    requestAnimationFrame(tick);
  }, [primeContext, decodeAll, startPlayback, tick]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    seekOffsetRef.current += (ctx.currentTime - startTimeRef.current) * speedRef.current;
    startTimeRef.current = 0;
    stopAllSources();
    setIsPlaying(false);
    playingRef.current = false;
    pauseKeepAlive();
    setMediaPlaybackState("paused");
  }, [stopAllSources, pauseKeepAlive]);

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
    pauseKeepAlive();
    setMediaPlaybackState("paused");
  }, [stopAllSources, pauseKeepAlive]);

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

  const setMediaMetadata = useCallback((title: string) => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: "StemDeck",
        // iOS ignores SVG artwork; PNGs (small first) show reliably on the lock screen.
        artwork: [
          { src: "/icon-96.png", sizes: "96x96", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.setActionHandler("play", () => play());
      navigator.mediaSession.setActionHandler("pause", () => pause());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) seek(details.seekTime);
      });
    }
  }, [play, pause, seek]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      const ctx = ctxRef.current;
      if (ctx && ctx.state === "suspended" && playingRef.current) {
        ctx.resume().then(() => {
          if (ctx.state === "running" && playingRef.current) {
            startPlayback();
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [startPlayback]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const handleStateChange = () => {
      if (ctx.state === "suspended" && playingRef.current) {
        ctx.resume().then(() => {
          if (ctx.state === "running" && playingRef.current) {
            startPlayback();
          }
        });
      }
    };
    ctx.addEventListener("statechange", handleStateChange);
    return () => ctx.removeEventListener("statechange", handleStateChange);
  });

  return {
    isLoading,
    isPlaying,
    speed,
    loadError,
    currentTime,
    duration,
    waveform,
    loadStems,
    primeContext,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setMute,
    setSpeed,
    setMediaMetadata,
    dispose,
  };
}
