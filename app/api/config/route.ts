import { env } from "cloudflare:workers";

type AppEnv = {
  SPOTIFY_CLIENT_ID?: string;
};

export async function GET() {
  const bindings = env as unknown as AppEnv;
  return Response.json(
    { spotifyClientId: bindings.SPOTIFY_CLIENT_ID?.trim() || null },
    { headers: { "cache-control": "no-store" } },
  );
}
