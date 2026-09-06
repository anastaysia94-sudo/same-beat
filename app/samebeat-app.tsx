"use client";

import {
  AlertTriangle,
  AudioLines,
  Check,
  Clock3,
  Disc3,
  Download,
  ExternalLink,
  Headphones,
  LoaderCircle,
  Mic2,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import YouTubeSyncPlayer from "./youtube-sync-player";
import { calculateTargetOffset } from "./sync-timing";

type Provider = "youtube" | "spotify" | "pandora";
type Phase = "idle" | "requesting" | "listening" | "matching" | "ready" | "error";

type SongMatch = {
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  observedOffsetMs: number;
  referenceTimestampMs: number;
  confidence: "high" | "medium" | "estimated";
  source: "audd" | "demo";
  spotifyUrl: string | null;
  spotifyUri: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  pandoraUrl: string | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CAPTURE_MS = 8_000;

const providers: Array<{
  id: Provider;
  name: string;
  detail: string;
  badge: string;
  icon: typeof Play;
}> = [
  {
    id: "youtube",
    name: "YouTube Music",
    detail: "Plays here at the detected moment",
    badge: "MVP ready",
    icon: Play,
  },
  {
    id: "spotify",
    name: "Spotify",
    detail: "Precise seek with Premium + connection",
    badge: "Connect",
    icon: Disc3,
  },
  {
    id: "pandora",
    name: "Pandora",
    detail: "Exact playback needs partner approval",
    badge: "Partner",
    icon: Radio,
  },
];

function formatTime(valueMs: number) {
  const safe = Math.max(0, Math.round(valueMs / 1_000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionFor(type: string) {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

function extractYouTubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function makeVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

async function makeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export default function SameBeatApp() {
  const [provider, setProvider] = useState<Provider>("youtube");
  const [phase, setPhase] = useState<Phase>("idle");
  const [captureProgress, setCaptureProgress] = useState(0);
  const [match, setMatch] = useState<SongMatch | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adjustmentMs, setAdjustmentMs] = useState(0);
  const [joinedOffsetMs, setJoinedOffsetMs] = useState<number | null>(null);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [manualYouTubeUrl, setManualYouTubeUrl] = useState("");
  const [spotifyClientId, setSpotifyClientId] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => window.removeEventListener("beforeinstallprompt", captureInstall);
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((data: { spotifyClientId?: string | null }) => {
        setSpotifyClientId(data.spotifyClientId ?? null);
      })
      .catch(() => setSpotifyClientId(null));

    const token = localStorage.getItem("samebeat_spotify_token");
    const expiresAt = Number(localStorage.getItem("samebeat_spotify_expires") ?? 0);
    setSpotifyConnected(Boolean(token && expiresAt > Date.now()));

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const verifier = sessionStorage.getItem("samebeat_spotify_verifier");
    if (!code || !verifier) return;

    const redirectUri = `${window.location.origin}/`;
    fetch("/api/spotify/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, verifier, redirectUri }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          accessToken?: string;
          expiresIn?: number;
          error?: string;
        };
        if (!response.ok || !payload.accessToken) {
          throw new Error(payload.error ?? "Spotify connection did not finish.");
        }
        localStorage.setItem("samebeat_spotify_token", payload.accessToken);
        localStorage.setItem(
          "samebeat_spotify_expires",
          String(Date.now() + (payload.expiresIn ?? 3_600) * 1_000 - 30_000),
        );
        setSpotifyConnected(true);
        setMessage("Spotify connected. Listen again, then tap Join on Spotify.");
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => {
        sessionStorage.removeItem("samebeat_spotify_verifier");
        window.history.replaceState({}, "", "/");
      });
  }, []);

  useEffect(() => {
    if (!match) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [match]);

  const currentOffsetMs = useMemo(() => {
    if (!match) return 0;
    return calculateTargetOffset(match, adjustmentMs, nowMs);
  }, [match, adjustmentMs, nowMs]);

  const progressPercent = match?.durationMs
    ? Math.min(100, Math.max(0, (currentOffsetMs / match.durationMs) * 100))
    : 0;

  const reset = useCallback(() => {
    setPhase("idle");
    setMatch(null);
    setMessage(null);
    setCaptureProgress(0);
    setAdjustmentMs(0);
    setJoinedOffsetMs(null);
    setYoutubePlaying(false);
    setManualYouTubeUrl("");
    setNowMs(Date.now());
  }, []);

  async function listen() {
    reset();
    setPhase("requesting");

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("This browser cannot record a song sample. Use current Chrome on Android or desktop.");
      setPhase("error");
      return;
    }

    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      const startedAt = Date.now();

      const stopped = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error("The recording stopped unexpectedly."));
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
      });

      setPhase("listening");
      recorder.start(250);
      interval = setInterval(() => {
        setCaptureProgress(Math.min(1, (Date.now() - startedAt) / CAPTURE_MS));
      }, 80);

      await new Promise((resolve) => window.setTimeout(resolve, CAPTURE_MS));
      recorder.stop();
      const sample = await stopped;
      const captureEndedAt = Date.now();

      if (interval) clearInterval(interval);
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      setCaptureProgress(1);
      setPhase("matching");

      const form = new FormData();
      form.append("file", sample, `samebeat-sample.${extensionFor(sample.type)}`);
      form.append("sampleDurationMs", String(captureEndedAt - startedAt));
      form.append("referenceTimestampMs", String(captureEndedAt));

      const response = await fetch("/api/recognize", { method: "POST", body: form });
      const payload = (await response.json()) as { match?: SongMatch; error?: string };
      if (!response.ok || !payload.match) {
        throw new Error(payload.error ?? "I could not identify that song.");
      }

      setMatch(payload.match);
      setPhase("ready");
    } catch (error) {
      if (interval) clearInterval(interval);
      stream?.getTracks().forEach((track) => track.stop());
      const text = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access is off. Allow it for SameBeat, then try again."
        : error instanceof Error
          ? error.message
          : "The song could not be matched.";
      setMessage(text);
      setPhase("error");
    }
  }

  function loadDemo() {
    const now = Date.now();
    setMatch({
      title: "Recognized song",
      artist: "Artist name",
      album: "Album",
      artworkUrl: null,
      durationMs: 218_000,
      observedOffsetMs: 84_000,
      referenceTimestampMs: now,
      confidence: "high",
      source: "demo",
      spotifyUrl: null,
      spotifyUri: null,
      youtubeUrl: null,
      youtubeVideoId: null,
      pandoraUrl: null,
    });
    setPhase("ready");
    setMessage("Demo result only — listen to a real song for working links and playback.");
  }

  async function beginSpotifyConnection() {
    if (!spotifyClientId) {
      setMessage("Spotify needs a developer Client ID before connection can be switched on.");
      return;
    }
    const verifier = makeVerifier();
    const challenge = await makeChallenge(verifier);
    const redirectUri = `${window.location.origin}/`;
    sessionStorage.setItem("samebeat_spotify_verifier", verifier);
    const params = new URLSearchParams({
      client_id: spotifyClientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "user-modify-playback-state user-read-playback-state",
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
  }

  async function joinSpotify(offsetMs: number, quiet = false) {
    const token = localStorage.getItem("samebeat_spotify_token");
    const expiresAt = Number(localStorage.getItem("samebeat_spotify_expires") ?? 0);
    if (!token || expiresAt <= Date.now()) {
      await beginSpotifyConnection();
      return;
    }
    if (!match?.spotifyUri) {
      setMessage("This match did not include a Spotify version. Try YouTube Music for this song.");
      return;
    }

    const response = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ uris: [match.spotifyUri], position_ms: Math.round(offsetMs) }),
    });

    if (response.status === 204) {
      setJoinedOffsetMs(offsetMs);
      if (!quiet) setMessage("Spotify joined. If it sounds a hair off, use the nudge buttons.");
      return;
    }
    if (response.status === 401) {
      localStorage.removeItem("samebeat_spotify_token");
      localStorage.removeItem("samebeat_spotify_expires");
      setSpotifyConnected(false);
      await beginSpotifyConnection();
      return;
    }
    if (response.status === 404) {
      setMessage("Open Spotify and play anything once so it has an active device, then return and tap Join again.");
      return;
    }
    setMessage("Spotify could not start this track. YouTube Music is the reliable MVP option.");
  }

  async function joinNow() {
    if (!match) return;
    setMessage(null);
    const offset = calculateTargetOffset(match, adjustmentMs);

    if (provider === "youtube") {
      const manualId = extractYouTubeId(manualYouTubeUrl);
      const videoId = manualId ?? match.youtubeVideoId;
      if (!videoId) {
        const query = encodeURIComponent(`${match.artist} ${match.title} official audio`);
        window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank", "noopener,noreferrer");
        setMessage("Choose the matching official audio, copy its link here, then tap Join again.");
        return;
      }
      setJoinedOffsetMs(offset);
      setYoutubePlaying(true);
      return;
    }

    if (provider === "spotify") {
      await joinSpotify(offset);
      return;
    }

    if (match.pandoraUrl) {
      window.open(match.pandoraUrl, "_blank", "noopener,noreferrer");
      setMessage("Pandora opened the match. Exact automatic seeking is held until Pandora approves the playback integration.");
    } else {
      const query = encodeURIComponent(`${match.artist} ${match.title}`);
      window.open(`https://www.pandora.com/search/${query}/all`, "_blank", "noopener,noreferrer");
      setMessage("Pandora search opened. Exact seeking needs Pandora partner access.");
    }
  }

  function adjustFineSync(deltaMs: number) {
    const nextAdjustment = Math.max(-15_000, Math.min(15_000, adjustmentMs + deltaMs));
    setAdjustmentMs(nextAdjustment);
    if (provider === "spotify" && match && joinedOffsetMs !== null) {
      void joinSpotify(calculateTargetOffset(match, nextAdjustment), true);
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  const selectedProvider = providers.find((item) => item.id === provider) ?? providers[0];
  const SelectedIcon = selectedProvider.icon;
  const manualYouTubeId = extractYouTubeId(manualYouTubeUrl);
  const youtubeId = manualYouTubeId ?? match?.youtubeVideoId;
  const manualYouTubeUrlInvalid = manualYouTubeUrl.trim().length > 0 && !manualYouTubeId;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="/" aria-label="SameBeat home">
          <span className="brand-mark" aria-hidden="true">
            <AudioLines size={21} strokeWidth={2.4} />
          </span>
          <span>SameBeat</span>
          <span className="beta-pill">beta</span>
        </a>
        <div className="top-actions">
          <span className="privacy-chip"><ShieldCheck size={15} /> Audio is not saved</span>
          {installPrompt && (
            <button className="install-button" onClick={installApp} type="button">
              <Download size={16} /> Install app
            </button>
          )}
        </div>
      </header>

      <section className="workspace" aria-label="Join a song">
        <div className="capture-panel">
          <div className="eyebrow"><Sparkles size={15} /> Live song alignment</div>
          <h1>Hear it. Catch it. Join it.</h1>
          <p className="intro">
            Let SameBeat listen for eight seconds. It identifies the recording and calculates the moment your friend has already reached.
          </p>

          {(phase === "idle" || phase === "requesting") && (
            <div className="listen-stage">
              <button
                className="listen-orb"
                type="button"
                onClick={listen}
                disabled={phase === "requesting"}
                aria-label="Listen and identify the song"
              >
                <span className="orb-ring ring-one" />
                <span className="orb-ring ring-two" />
                <span className="orb-core">
                  {phase === "requesting" ? <LoaderCircle className="spin" size={34} /> : <Mic2 size={35} />}
                </span>
              </button>
              <div className="stage-copy">
                <strong>{phase === "requesting" ? "Waiting for microphone…" : "Tap to listen"}</strong>
                <span>Keep this phone near the music</span>
              </div>
            </div>
          )}

          {phase === "listening" && (
            <div className="listen-stage" aria-live="polite">
              <div className="progress-orb" style={{ "--listen-progress": `${captureProgress * 360}deg` } as React.CSSProperties}>
                <span className="orb-core active"><Volume2 size={34} /></span>
              </div>
              <div className="waveform" aria-hidden="true">
                {Array.from({ length: 21 }, (_, index) => <span key={index} style={{ animationDelay: `${index * -55}ms` }} />)}
              </div>
              <div className="stage-copy">
                <strong>Listening… {Math.max(1, Math.ceil((CAPTURE_MS * (1 - captureProgress)) / 1_000))}s</strong>
                <span>Music only—conversation makes matching harder</span>
              </div>
            </div>
          )}

          {phase === "matching" && (
            <div className="listen-stage" aria-live="polite">
              <div className="matching-mark"><LoaderCircle className="spin" size={38} /></div>
              <div className="stage-copy">
                <strong>Finding the exact recording</strong>
                <span>Matching the song, version, and current timestamp</span>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="error-state" role="alert">
              <span className="error-icon"><AlertTriangle size={24} /></span>
              <div>
                <strong>That one got away.</strong>
                <p>{message}</p>
              </div>
              <button type="button" onClick={listen}><RefreshCw size={17} /> Try again</button>
            </div>
          )}

          {phase === "ready" && match && (
            <div className="match-wrap" aria-live="polite">
              <div className="match-card">
                <div className="album-art">
                  {match.artworkUrl ? (
                    <img src={match.artworkUrl} alt="" />
                  ) : (
                    <AudioLines size={38} aria-hidden="true" />
                  )}
                  <span className="match-check"><Check size={14} strokeWidth={3} /></span>
                </div>
                <div className="track-copy">
                  <span className="matched-label">Matched · {match.confidence} confidence</span>
                  <h2>{match.title}</h2>
                  <p>{match.artist}{match.album ? ` · ${match.album}` : ""}</p>
                </div>
                <button className="icon-button" type="button" onClick={listen} aria-label="Listen again">
                  <RefreshCw size={19} />
                </button>
              </div>

              <div className="timeline-card">
                <div className="timeline-labels">
                  <span><Clock3 size={15} /> Friend is near <strong>{formatTime(currentOffsetMs)}</strong></span>
                  <span>{match.durationMs ? formatTime(match.durationMs) : "Live"}</span>
                </div>
                <div className="track-line"><span style={{ width: `${progressPercent}%` }} /></div>
                <div className="nudge-row">
                  <span>Fine sync</span>
                  <div>
                    <button type="button" onClick={() => adjustFineSync(-500)} aria-label="Move playback half a second earlier"><SkipBack size={16} /> 0.5s</button>
                    <output>{adjustmentMs === 0 ? "On estimate" : `${adjustmentMs > 0 ? "+" : ""}${(adjustmentMs / 1_000).toFixed(1)}s`}</output>
                    <button type="button" onClick={() => adjustFineSync(500)} aria-label="Move playback half a second later">0.5s <SkipForward size={16} /></button>
                  </div>
                </div>
              </div>

              {provider === "youtube" && (
                <details
                  className="manual-link"
                  defaultOpen={!match.youtubeVideoId}
                  key={match.youtubeVideoId ?? "youtube-link-required"}
                >
                  <summary>
                    <span>Use a different YouTube version</span>
                    <small>
                      {manualYouTubeId
                        ? "Custom version active"
                        : match.youtubeVideoId
                          ? "Fix a long intro, remix, or live recording"
                          : "Add the matching recording to play"}
                    </small>
                  </summary>
                  <input
                    type="url"
                    value={manualYouTubeUrl}
                    onChange={(event) => setManualYouTubeUrl(event.target.value)}
                    placeholder="Paste the matching YouTube link"
                    aria-label="Matching YouTube video link"
                    aria-invalid={manualYouTubeUrlInvalid}
                  />
                  {manualYouTubeUrlInvalid && (
                    <small className="link-error">Use a full youtube.com or youtu.be link.</small>
                  )}
                </details>
              )}

              {provider === "youtube" && youtubePlaying && youtubeId && joinedOffsetMs !== null && (
                <YouTubeSyncPlayer
                  key={`${youtubeId}-${joinedOffsetMs}`}
                  videoId={youtubeId}
                  observedOffsetMs={match.observedOffsetMs}
                  referenceTimestampMs={match.referenceTimestampMs}
                  adjustmentMs={adjustmentMs}
                  durationMs={match.durationMs}
                />
              )}
            </div>
          )}

          {message && phase !== "error" && (
            <div className="notice"><AlertTriangle size={17} /><span>{message}</span></div>
          )}

          {phase === "idle" && (
            <button className="demo-button" type="button" onClick={loadDemo}>Preview a sample result</button>
          )}
        </div>

        <aside className="control-panel">
          <div className="control-heading">
            <div>
              <span className="step-number">01</span>
              <h2>Choose where to listen</h2>
            </div>
            <Headphones size={23} />
          </div>

          <RadioGroup value={provider} onValueChange={(value) => setProvider(value as Provider)} aria-label="Music service">
            {providers.map((item) => {
              const Icon = item.icon;
              const selected = provider === item.id;
              return (
                <label className={`provider-card ${selected ? "selected" : ""}`} key={item.id}>
                  <RadioGroupItem value={item.id} className="sr-only" />
                  <span className={`provider-icon ${item.id}`}><Icon size={22} /></span>
                  <span className="provider-copy"><strong>{item.name}</strong><small>{item.detail}</small></span>
                  <span className="provider-badge">{item.badge}</span>
                  <span className="radio-dot">{selected && <span />}</span>
                </label>
              );
            })}
          </RadioGroup>

          <div className="join-box">
            <div className="join-service"><SelectedIcon size={18} /><span>{selectedProvider.name}</span></div>
            <button className="join-button" type="button" disabled={!match || phase !== "ready"} onClick={joinNow}>
              {provider === "spotify" && !spotifyConnected ? "Connect Spotify" : provider === "pandora" ? "Open in Pandora" : "Join the song now"}
              <span>{match ? formatTime(currentOffsetMs) : "—:—"}</span>
            </button>
            <p>
              {provider === "youtube" && "Starts the matched YouTube Music recording at the calculated moment."}
              {provider === "spotify" && "Requires Spotify Premium and one active Spotify playback device."}
              {provider === "pandora" && "Opens the match now; exact seek activates after Pandora partner certification."}
            </p>
          </div>

          <div className="how-it-works">
            <span className="step-number">02</span>
            <h2>What SameBeat calculates</h2>
            <ol>
              <li><span><Mic2 size={16} /></span><div><strong>8-second sample</strong><small>Enough sound to fingerprint the recording</small></div></li>
              <li><span><AudioLines size={16} /></span><div><strong>Song + timestamp</strong><small>The exact version and point already playing</small></div></li>
              <li><span><Clock3 size={16} /></span><div><strong>Delay catch-up</strong><small>Adds recognition and loading time before playback</small></div></li>
            </ol>
          </div>

          <div className="privacy-note">
            <ShieldCheck size={19} />
            <div><strong>Private by default</strong><p>The short sample is sent only for recognition and is not stored by SameBeat.</p></div>
          </div>
        </aside>
      </section>

      <footer>
        <span>SameBeat · public beta</span>
        <a href="https://docs.audd.io/" target="_blank" rel="noreferrer">Recognition details <ExternalLink size={13} /></a>
      </footer>
    </main>
  );
}
