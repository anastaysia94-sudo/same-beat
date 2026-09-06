import { env } from "cloudflare:workers";

export const runtime = "edge";

type AppEnv = {
  AUDD_API_TOKEN?: string;
  YOUTUBE_API_KEY?: string;
};

type AudDResult = {
  status?: string;
  error?: { error_message?: string };
  result?: {
    artist?: string;
    title?: string;
    album?: string;
    timecode?: string;
    song_link?: string;
    spotify?: {
      uri?: string;
      duration_ms?: number;
      external_urls?: { spotify?: string };
      album?: { images?: Array<{ url?: string; width?: number; height?: number }> };
    };
    apple_music?: {
      artwork?: { url?: string };
      durationInMillis?: number;
    };
  } | null;
};

type LinkResponse = {
  linksByPlatform?: Record<string, { url?: string }>;
};

function parseTimecode(value?: string) {
  if (!value) return 0;
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0) * 1_000;
}

function extractYouTubeId(value?: string | null) {
  if (!value) return null;
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

async function resolvePlatformLinks(seedUrl: string | null) {
  if (!seedUrl) return {} as Record<string, string | null>;
  try {
    const response = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(seedUrl)}&userCountry=US`,
      { signal: AbortSignal.timeout(4_500) },
    );
    if (!response.ok) return {} as Record<string, string | null>;
    const payload = (await response.json()) as LinkResponse;
    return {
      youtubeUrl: payload.linksByPlatform?.youtubeMusic?.url ?? payload.linksByPlatform?.youtube?.url ?? null,
      pandoraUrl: payload.linksByPlatform?.pandora?.url ?? null,
      spotifyUrl: payload.linksByPlatform?.spotify?.url ?? null,
    };
  } catch {
    return {} as Record<string, string | null>;
  }
}

async function searchYouTube(apiKey: string | undefined, artist: string, title: string) {
  if (!apiKey) return null;
  const query = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: "5",
    q: `${artist} ${title} official audio`,
    key: apiKey,
  });
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${query}`, {
      signal: AbortSignal.timeout(4_500),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { items?: Array<{ id?: { videoId?: string } }> };
    return payload.items?.find((item) => item.id?.videoId)?.id?.videoId ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const bindings = env as unknown as AppEnv;
  const form = await request.formData().catch(() => null);
  const sample = form?.get("file");
  const referenceTimestampMs = Number(form?.get("referenceTimestampMs"));

  if (!(sample instanceof File) || sample.size === 0) {
    return Response.json({ error: "No audio sample arrived. Please listen again." }, { status: 400 });
  }
  if (sample.size > 8 * 1024 * 1024) {
    return Response.json({ error: "The audio sample was unexpectedly large." }, { status: 413 });
  }

  const recognitionForm = new FormData();
  recognitionForm.append("api_token", bindings.AUDD_API_TOKEN?.trim() || "test");
  recognitionForm.append("return", "spotify,apple_music");
  recognitionForm.append("file", sample, sample.name || "samebeat-sample.webm");

  let response: Response;
  try {
    response = await fetch("https://api.audd.io/", {
      method: "POST",
      body: recognitionForm,
      signal: AbortSignal.timeout(18_000),
    });
  } catch {
    return Response.json({ error: "The recognition service did not answer. Try again in a moment." }, { status: 504 });
  }

  const audd = (await response.json().catch(() => null)) as AudDResult | null;
  if (!response.ok || audd?.status !== "success") {
    const upstreamMessage = audd?.error?.error_message ?? "Song recognition is temporarily unavailable.";
    const quotaMessage = /limit|token|requests/i.test(upstreamMessage)
      ? "The shared demo recognition limit has been reached. Add a production AudD key to keep listening."
      : upstreamMessage;
    return Response.json({ error: quotaMessage }, { status: 502 });
  }
  if (!audd.result?.artist || !audd.result.title) {
    return Response.json({ error: "No confident match yet. Move closer to the speaker and try again." }, { status: 404 });
  }

  const spotifyUrl = audd.result.spotify?.external_urls?.spotify ?? null;
  const links = await resolvePlatformLinks(spotifyUrl ?? audd.result.song_link ?? null);
  const youtubeUrl = links.youtubeUrl ?? null;
  const youtubeVideoId = extractYouTubeId(youtubeUrl)
    ?? await searchYouTube(bindings.YOUTUBE_API_KEY?.trim(), audd.result.artist, audd.result.title);
  const appleArt = audd.result.apple_music?.artwork?.url?.replace("{w}", "480").replace("{h}", "480") ?? null;
  const spotifyArt = audd.result.spotify?.album?.images?.find((image) => image.url)?.url ?? null;
  const durationMs = audd.result.spotify?.duration_ms ?? audd.result.apple_music?.durationInMillis ?? null;

  return Response.json(
    {
      match: {
        title: audd.result.title,
        artist: audd.result.artist,
        album: audd.result.album ?? null,
        artworkUrl: spotifyArt ?? appleArt,
        durationMs,
        observedOffsetMs: parseTimecode(audd.result.timecode),
        referenceTimestampMs: Number.isFinite(referenceTimestampMs) ? referenceTimestampMs : Date.now(),
        confidence: "estimated",
        source: "audd",
        spotifyUrl: spotifyUrl ?? links.spotifyUrl ?? null,
        spotifyUri: audd.result.spotify?.uri ?? null,
        youtubeUrl,
        youtubeVideoId,
        pandoraUrl: links.pandoraUrl ?? null,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
