import { env } from "cloudflare:workers";

export const runtime = "edge";

type AppEnv = {
  AUDD_API_TOKEN?: string;
  YOUTUBE_API_KEY?: string;
  SPOTIFY_CLIENT_ID?: string;
};

export async function GET() {
  const bindings = env as unknown as AppEnv;
  const auddConfigured = Boolean(bindings.AUDD_API_TOKEN?.trim());
  const youtubeConfigured = Boolean(bindings.YOUTUBE_API_KEY?.trim());
  const spotifyConfigured = Boolean(bindings.SPOTIFY_CLIENT_ID?.trim());

  return Response.json(
    {
      checkedAt: new Date().toISOString(),
      recognition: {
        provider: "AudD",
        state: auddConfigured ? "production_configured" : "demo_limited",
        dependableForProduction: auddConfigured,
        note: auddConfigured
          ? "A dedicated server-side recognition token is configured."
          : "The shared AudD test token is limited and is suitable only for evaluation.",
      },
      youtube: {
        state: youtubeConfigured ? "api_fallback_configured" : "songlink_only",
        note: youtubeConfigured
          ? "YouTube Data API fallback is configured server-side."
          : "SameBeat uses Songlink/Odesli mappings when available; YouTube search fallback is not configured.",
      },
      spotify: {
        state: spotifyConfigured ? "client_configured" : "not_configured",
        note: spotifyConfigured
          ? "Spotify public-client PKCE configuration is present. Premium, an active device, and provider policy/approval can still apply."
          : "Spotify playback control is unavailable until an owner-controlled client ID and redirect URI are configured.",
      },
      pandora: {
        state: "partner_access_required",
        note: "Automatic exact playback/seek is not represented as available without documented Pandora partner authorization.",
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
      },
    },
  );
}
