import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "SameBeat privacy practices for microphone capture, recognition, playback providers, and local data.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 22px 80px" }}>
      <p><a href="/">← SameBeat</a> · <a href="/how-it-works">How it works</a> · <a href="/providers">Providers</a></p>
      <p className="eyebrow">SAMEBEAT · PRIVACY BASELINE</p>
      <h1>Privacy without pretending the microphone is harmless magic</h1>
      <p>SameBeat asks for microphone access only after a clear user action. Capture is intended to last only long enough to create the short recognition sample.</p>
      <h2>What this codebase does not persist</h2>
      <ul>
        <li>Captured microphone audio</li>
        <li>Recognition results or listening history</li>
        <li>Third-party music-service passwords</li>
      </ul>
      <h2>What leaves the device</h2>
      <p>The short audio sample is sent to the configured song-recognition provider so it can identify the recording and estimate a position. Provider processing and retention are governed by that provider's current terms and privacy practices.</p>
      <h2>Playback providers</h2>
      <p>When you choose YouTube, Spotify, Pandora, or another supported provider, that provider receives the requests needed for its authorized playback path. SameBeat should not impersonate a provider login page or collect a provider password.</p>
      <h2>Spotify authentication</h2>
      <p>SameBeat uses a public-client PKCE design. The project does not require a Spotify client secret in the browser or repository.</p>
      <h2>Operational data</h2>
      <p>If privacy-preserving monitoring is added, it should measure service reliability without collecting the audio sample or building a listening-history profile by default.</p>
      <h2>Your control</h2>
      <p>You can decline microphone permission and not use recognition. Browser permission controls can revoke microphone access later.</p>
      <p><strong>Important:</strong> this page describes the privacy behavior intended and implemented by the SameBeat codebase. Deployment operators must also verify the current policies of every connected provider before public release.</p>
    </main>
  );
}
