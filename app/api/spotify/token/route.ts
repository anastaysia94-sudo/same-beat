import { env } from "cloudflare:workers";

type AppEnv = {
  SPOTIFY_CLIENT_ID?: string;
};

export async function POST(request: Request) {
  const bindings = env as unknown as AppEnv;
  const clientId = bindings.SPOTIFY_CLIENT_ID?.trim();
  if (!clientId) {
    return Response.json({ error: "Spotify is not configured yet." }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as {
    code?: string;
    verifier?: string;
    redirectUri?: string;
  } | null;

  if (!payload?.code || !payload.verifier || !payload.redirectUri) {
    return Response.json({ error: "Spotify connection details are incomplete." }, { status: 400 });
  }

  const redirect = new URL(payload.redirectUri);
  const requestOrigin = new URL(request.url).origin;
  if (redirect.origin !== requestOrigin || redirect.pathname !== "/") {
    return Response.json({ error: "Spotify redirect did not match this app." }, { status: 400 });
  }

  const form = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code: payload.code,
    redirect_uri: payload.redirectUri,
    code_verifier: payload.verifier,
  });

  const spotifyResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const spotify = (await spotifyResponse.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  } | null;

  if (!spotifyResponse.ok || !spotify?.access_token) {
    return Response.json(
      { error: spotify?.error_description ?? "Spotify refused the connection." },
      { status: 502 },
    );
  }

  return Response.json(
    { accessToken: spotify.access_token, expiresIn: spotify.expires_in ?? 3_600 },
    { headers: { "cache-control": "no-store" } },
  );
}
