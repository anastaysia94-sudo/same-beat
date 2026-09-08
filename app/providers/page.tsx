import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Music Provider Support",
  description: "SameBeat provider support for AudD recognition, YouTube, Spotify, and Pandora, including honest configuration and approval limits.",
  alternates: { canonical: "/providers" },
};

export default function Providers() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 22px 80px" }}>
      <p><a href="/">← SameBeat</a> · <a href="/how-it-works">How it works</a> · <a href="/privacy">Privacy</a></p>
      <p className="eyebrow">SAMEBEAT · PROVIDER REALITY CHECK</p>
      <h1>What works, what needs configuration, and what requires approval</h1>
      <section><h2>AudD recognition</h2><p>SameBeat can identify recordings and estimate a source timecode through AudD. A dedicated server-side token is required for dependable production use. Without it, the app can fall back to a shared test token with a small daily limit.</p></section>
      <section><h2>YouTube / YouTube Music</h2><p>SameBeat can resolve mapped links and use the official YouTube embedded player. An optional YouTube Data API key improves fallback search when a cross-platform mapping is missing.</p></section>
      <section><h2>Spotify</h2><p>SameBeat implements Authorization Code with PKCE and position-based playback for supported Spotify accounts/devices. An owner-controlled Spotify application, correct redirect URI, Premium playback conditions, and any required platform review still apply.</p></section>
      <section><h2>Pandora</h2><p>Public exact-playback/seek support is not represented as available without documented Pandora partner access. SameBeat can provide an honest external fallback rather than manufacturing a successful seek.</p></section>
      <section><h2>Live configuration status</h2><p>The deployment exposes a credential-safe machine-readable status endpoint at <a href="/api/provider-status">/api/provider-status</a>. It reports whether production recognition, YouTube fallback, and Spotify client configuration are present without exposing keys.</p></section>
    </main>
  );
}
