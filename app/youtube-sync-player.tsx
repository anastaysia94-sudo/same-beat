"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer };
type YouTubePlayerStateEvent = YouTubePlayerEvent & { data: number };
type YouTubePlayerErrorEvent = { data: number };

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerStateEvent) => void;
        onAutoplayBlocked: () => void;
        onError: (event: YouTubePlayerErrorEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
    UNSTARTED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Timing = {
  observedOffsetMs: number;
  referenceTimestampMs: number;
  adjustmentMs: number;
  durationMs: number | null;
};

type SyncState = "loading" | "aligning" | "playing" | "paused" | "buffering" | "tap" | "error";

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  const request = new Promise<YouTubeNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("YouTube player took too long to load.")), 15_000);
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube player did not initialize."));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-samebeat-youtube-api="true"]');
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.samebeatYoutubeApi = "true";
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("YouTube player could not be loaded."));
    }, { once: true });
    document.head.appendChild(script);
  });

  youtubeApiPromise = request.catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
}

function targetOffsetMs(timing: Timing, atMs = Date.now()) {
  const elapsed = Math.max(0, atMs - timing.referenceTimestampMs);
  const target = Math.max(0, timing.observedOffsetMs + elapsed + timing.adjustmentMs);
  return timing.durationMs ? Math.min(target, Math.max(0, timing.durationMs - 250)) : target;
}

function driftLabel(driftMs: number | null, state: SyncState) {
  if (state === "loading") return { title: "Loading player", detail: "Preparing the matched recording", tone: "waiting" };
  if (state === "aligning") return { title: "Aligning now", detail: "Seeking to the live target", tone: "waiting" };
  if (state === "tap") return { title: "Tap play", detail: "Your browser blocked automatic playback", tone: "attention" };
  if (state === "error") return { title: "Player unavailable", detail: "Open the track in YouTube Music instead", tone: "attention" };
  if (state === "paused") return { title: "Playback paused", detail: "Resync when you are ready to rejoin", tone: "paused" };
  if (state === "buffering") return { title: "Buffering", detail: "SameBeat will keep measuring the gap", tone: "waiting" };
  if (driftMs === null) return { title: "Measuring sync", detail: "Reading the player position", tone: "waiting" };

  const absolute = Math.abs(driftMs);
  if (absolute <= 450) return { title: "In sync", detail: `Within ${(absolute / 1_000).toFixed(2)}s of the target`, tone: "synced" };
  const direction = driftMs > 0 ? "ahead" : "behind";
  return {
    title: `${(absolute / 1_000).toFixed(1)}s ${direction}`,
    detail: "Tap Resync or use the half-second nudges",
    tone: absolute <= 1_250 ? "close" : "attention",
  };
}

export default function YouTubeSyncPlayer({
  videoId,
  observedOffsetMs,
  referenceTimestampMs,
  adjustmentMs,
  durationMs,
}: Timing & { videoId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timingRef = useRef<Timing>({ observedOffsetMs, referenceTimestampMs, adjustmentMs, durationMs });
  const autoplayBlockedRef = useRef(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [driftMs, setDriftMs] = useState<number | null>(null);

  timingRef.current = { observedOffsetMs, referenceTimestampMs, adjustmentMs, durationMs };

  function resync() {
    const player = playerRef.current;
    if (!player) return;
    setSyncState("aligning");
    player.seekTo(targetOffsetMs(timingRef.current) / 1_000, true);
    player.playVideo();
  }

  useEffect(() => {
    let cancelled = false;
    let pollId: number | null = null;
    const mount = mountRef.current;
    if (!mount) return;

    setSyncState("loading");
    setDriftMs(null);

    loadYouTubeApi()
      .then((youtube) => {
        if (cancelled) return;
        const initialTarget = targetOffsetMs(timingRef.current);
        const player = new youtube.Player(mount, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
            start: Math.max(0, Math.floor(initialTarget / 1_000)),
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              setSyncState("aligning");
              event.target.seekTo(targetOffsetMs(timingRef.current) / 1_000, true);
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === youtube.PlayerState.PLAYING) {
                if (autoplayBlockedRef.current) {
                  autoplayBlockedRef.current = false;
                  event.target.seekTo(targetOffsetMs(timingRef.current) / 1_000, true);
                }
                setSyncState("playing");
              } else if (event.data === youtube.PlayerState.PAUSED) {
                setSyncState("paused");
              } else if (event.data === youtube.PlayerState.BUFFERING) {
                setSyncState("buffering");
              }
            },
            onAutoplayBlocked: () => {
              autoplayBlockedRef.current = true;
              setSyncState("tap");
            },
            onError: () => setSyncState("error"),
          },
        });
        playerRef.current = player;

        pollId = window.setInterval(() => {
          const currentPlayer = playerRef.current;
          if (!currentPlayer) return;
          const currentTime = currentPlayer.getCurrentTime();
          if (!Number.isFinite(currentTime)) return;
          setDriftMs(currentTime * 1_000 - targetOffsetMs(timingRef.current));
        }, 500);
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      });

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(targetOffsetMs(timingRef.current) / 1_000, true);
  }, [adjustmentMs]);

  const label = driftLabel(driftMs, syncState);

  return (
    <div className="player-stack">
      <div className="player-frame">
        <div ref={mountRef} aria-label="YouTube playback synchronized by SameBeat" />
      </div>
      <div className={`live-sync-bar ${label.tone}`} aria-live="polite">
        <span className="sync-indicator" aria-hidden="true" />
        <div>
          <strong>{label.title}</strong>
          <span>{label.detail}</span>
        </div>
        <button type="button" onClick={resync} disabled={syncState === "loading" || syncState === "error"}>
          <RefreshCw size={15} /> Resync now
        </button>
      </div>
    </div>
  );
}
