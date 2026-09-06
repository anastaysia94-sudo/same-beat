"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AUTO_RESYNC_DRIFT_MS,
  AUTO_RESYNC_SAMPLE_COUNT,
  MAX_AUTO_RESYNCS,
  STABLE_RESET_SAMPLE_COUNT,
  calculateTargetOffset,
  detectDurationMismatch,
  shouldAutoResync,
  type DurationMismatch,
  type TrackClock,
} from "./sync-timing";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
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

type Timing = TrackClock & {
  adjustmentMs: number;
};

type SyncState = "loading" | "aligning" | "correcting" | "playing" | "paused" | "buffering" | "tap" | "error";

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

function driftLabel(driftMs: number | null, state: SyncState, autoCorrectionCount: number) {
  if (state === "loading") return { title: "Loading player", detail: "Preparing the matched recording", tone: "waiting" };
  if (state === "aligning") return { title: "Aligning now", detail: "Seeking to the live target", tone: "waiting" };
  if (state === "correcting") return { title: "Auto-correcting", detail: "Recovering from sustained playback drift", tone: "waiting" };
  if (state === "tap") return { title: "Tap play", detail: "Your browser blocked automatic playback", tone: "attention" };
  if (state === "error") return { title: "Player unavailable", detail: "Open the track in YouTube Music instead", tone: "attention" };
  if (state === "paused") return { title: "Playback paused", detail: "Resync when you are ready to rejoin", tone: "paused" };
  if (state === "buffering") return { title: "Buffering", detail: "SameBeat will keep measuring the gap", tone: "waiting" };
  if (driftMs === null) return { title: "Measuring sync", detail: "Reading the player position", tone: "waiting" };

  const absolute = Math.abs(driftMs);
  if (absolute <= 450) {
    return {
      title: autoCorrectionCount ? "Back in sync" : "In sync",
      detail: `${autoCorrectionCount ? "Automatic recovery worked · " : ""}within ${(absolute / 1_000).toFixed(2)}s`,
      tone: "synced",
    };
  }
  const direction = driftMs > 0 ? "ahead" : "behind";
  return {
    title: `${(absolute / 1_000).toFixed(1)}s ${direction}`,
    detail: "Tap Resync or use the half-second nudges",
    tone: absolute <= 1_250 ? "close" : "attention",
  };
}

function formatDurationGap(valueMs: number) {
  const totalSeconds = Math.max(1, Math.round(valueMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
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
  const largeDriftSamplesRef = useRef(0);
  const stableSamplesRef = useRef(0);
  const lastCorrectionAtRef = useRef(0);
  const autoCorrectionCountRef = useRef(0);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [driftMs, setDriftMs] = useState<number | null>(null);
  const [versionMismatch, setVersionMismatch] = useState<DurationMismatch | null>(null);
  const [autoCorrectionCount, setAutoCorrectionCount] = useState(0);
  const [autoRecoveryPaused, setAutoRecoveryPaused] = useState(false);

  timingRef.current = { observedOffsetMs, referenceTimestampMs, adjustmentMs, durationMs };

  function seekToLiveTarget(automatic: boolean) {
    const player = playerRef.current;
    if (!player) return;
    largeDriftSamplesRef.current = 0;
    stableSamplesRef.current = 0;
    lastCorrectionAtRef.current = Date.now();
    if (automatic) {
      autoCorrectionCountRef.current += 1;
      setAutoCorrectionCount(autoCorrectionCountRef.current);
      setSyncState("correcting");
    } else {
      autoCorrectionCountRef.current = 0;
      setAutoCorrectionCount(0);
      setAutoRecoveryPaused(false);
      setSyncState("aligning");
    }
    player.seekTo(
      calculateTargetOffset(timingRef.current, timingRef.current.adjustmentMs) / 1_000,
      true,
    );
    player.playVideo();
  }

  function resync() {
    seekToLiveTarget(false);
  }

  useEffect(() => {
    let cancelled = false;
    let pollId: number | null = null;
    const mount = mountRef.current;
    if (!mount) return;

    setSyncState("loading");
    setDriftMs(null);
    setVersionMismatch(null);
    setAutoCorrectionCount(0);
    setAutoRecoveryPaused(false);
    autoplayBlockedRef.current = false;
    largeDriftSamplesRef.current = 0;
    stableSamplesRef.current = 0;
    lastCorrectionAtRef.current = 0;
    autoCorrectionCountRef.current = 0;

    loadYouTubeApi()
      .then((youtube) => {
        if (cancelled) return;
        const initialTarget = calculateTargetOffset(
          timingRef.current,
          timingRef.current.adjustmentMs,
        );
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
              lastCorrectionAtRef.current = Date.now();
              setSyncState("aligning");
              event.target.seekTo(
                calculateTargetOffset(timingRef.current, timingRef.current.adjustmentMs) / 1_000,
                true,
              );
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === youtube.PlayerState.PLAYING) {
                if (autoplayBlockedRef.current) {
                  autoplayBlockedRef.current = false;
                  event.target.seekTo(
                    calculateTargetOffset(timingRef.current, timingRef.current.adjustmentMs) / 1_000,
                    true,
                  );
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
          const now = Date.now();
          const liveTargetMs = calculateTargetOffset(
            timingRef.current,
            timingRef.current.adjustmentMs,
            now,
          );
          const nextDriftMs = currentTime * 1_000 - liveTargetMs;
          setDriftMs(nextDriftMs);

          const nextMismatch = detectDurationMismatch(
            timingRef.current.durationMs,
            currentPlayer.getDuration(),
          );
          setVersionMismatch((current) => {
            if (!current && !nextMismatch) return current;
            if (
              current
              && nextMismatch
              && current.differenceMs === nextMismatch.differenceMs
              && current.direction === nextMismatch.direction
            ) return current;
            return nextMismatch;
          });

          const isPlaying = currentPlayer.getPlayerState() === youtube.PlayerState.PLAYING;
          const nearRecognizedEnd = timingRef.current.durationMs !== null
            && liveTargetMs >= timingRef.current.durationMs - 2_500;
          if (!isPlaying || nearRecognizedEnd) {
            largeDriftSamplesRef.current = 0;
            stableSamplesRef.current = 0;
            return;
          }

          if (Math.abs(nextDriftMs) >= AUTO_RESYNC_DRIFT_MS) {
            largeDriftSamplesRef.current += 1;
            stableSamplesRef.current = 0;
          } else if (Math.abs(nextDriftMs) <= 450) {
            largeDriftSamplesRef.current = 0;
            stableSamplesRef.current += 1;
            if (stableSamplesRef.current >= STABLE_RESET_SAMPLE_COUNT) {
              autoCorrectionCountRef.current = 0;
              setAutoCorrectionCount(0);
              setAutoRecoveryPaused(false);
              stableSamplesRef.current = 0;
            }
          } else {
            largeDriftSamplesRef.current = 0;
            stableSamplesRef.current = 0;
          }

          if (shouldAutoResync({
            driftMs: nextDriftMs,
            consecutiveLargeSamples: largeDriftSamplesRef.current,
            timeSinceLastCorrectionMs: now - lastCorrectionAtRef.current,
            isPlaying,
            correctionCount: autoCorrectionCountRef.current,
          })) {
            seekToLiveTarget(true);
            return;
          }

          if (
            largeDriftSamplesRef.current >= AUTO_RESYNC_SAMPLE_COUNT
            && autoCorrectionCountRef.current >= MAX_AUTO_RESYNCS
          ) {
            setAutoRecoveryPaused(true);
          }
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
    largeDriftSamplesRef.current = 0;
    stableSamplesRef.current = 0;
    lastCorrectionAtRef.current = Date.now();
    autoCorrectionCountRef.current = 0;
    setAutoCorrectionCount(0);
    setAutoRecoveryPaused(false);
    setSyncState("aligning");
    playerRef.current.seekTo(
      calculateTargetOffset(timingRef.current, timingRef.current.adjustmentMs) / 1_000,
      true,
    );
    playerRef.current.playVideo();
  }, [adjustmentMs]);

  const label = driftLabel(driftMs, syncState, autoCorrectionCount);

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
      {versionMismatch && (
        <div className="version-warning" role="status">
          <AlertTriangle size={17} />
          <div>
            <strong>Possible version mismatch</strong>
            <span>
              This YouTube recording is {formatDurationGap(versionMismatch.differenceMs)} {versionMismatch.direction} than the matched track. Try a different YouTube version if the audio feels off.
            </span>
          </div>
        </div>
      )}
      {autoRecoveryPaused && !versionMismatch && (
        <div className="version-warning" role="status">
          <AlertTriangle size={17} />
          <div>
            <strong>Playback keeps drifting</strong>
            <span>Automatic recovery paused after three attempts. Try Resync now or choose a different YouTube version.</span>
          </div>
        </div>
      )}
    </div>
  );
}
