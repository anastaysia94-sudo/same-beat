import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How SameBeat Works",
  description:
    "How SameBeat recognizes a nearby song, estimates its current position, accounts for delay, and starts an authorized stream near the same moment.",
  alternates: { canonical: "/how-it-works" },
};

const answers = [
  [
    "What does SameBeat do?",
    "SameBeat records a short sample only after you tap the listen control, asks a recognition provider to identify the recording and estimate its position, then calculates where the song should be by the time your own stream is ready to play.",
  ],
  [
    "How does SameBeat calculate the target position?",
    "The core model is: recognized source position + time elapsed after capture + your manual calibration. SameBeat also measures supported player time so it can show drift and make bounded recovery adjustments.",
  ],
  [
    "Is the timing acoustically perfect?",
    "No. Recognition timecodes, network delay, buffering, keyframe seeking, alternate masters, music-video intros, live versions and browser playback rules can all introduce offset. SameBeat reports timing as estimated or measured instead of claiming sample-perfect lock when it has not acoustically compared two devices.",
  ],
  [
    "Does SameBeat keep the microphone recording?",
    "The application records a short clip for recognition after explicit permission. This codebase does not persist the captured clip, recognition result or listening history. Production privacy disclosures also need to describe how the external recognition provider processes the sample.",
  ],
  [
    "Which music services work?",
    "YouTube/YouTube Music is the strongest current browser path. Spotify can use Authorization Code with PKCE and position-based playback when an owner-controlled client is configured and the account/device/provider requirements are met. Pandora exact automatic seeking remains partner-gated and is not simulated as working.",
  ],
  [
    "What happens when the wrong recording is matched?",
    "SameBeat compares durations as a warning signal and lets you replace the automatic YouTube match. A duration warning is a heuristic, not proof that two recordings are aligned or misaligned.",
  ],
];

export default function HowItWorks() {
  const structured = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How SameBeat Works",
    about: { "@type": "SoftwareApplication", name: "SameBeat" },
    publisher: { "@type": "Organization", name: "SmartPickShop Holdings" },
  };
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 22px 80px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
      />
      <p><a href="/">← SameBeat</a> · <a href="/providers">Provider status</a> · <a href="/privacy">Privacy</a></p>
      <p className="eyebrow">SAMEBEAT · PLAIN-ENGLISH GUIDE</p>
      <h1>How SameBeat joins a song already playing</h1>
      <p>
        SameBeat is not trying to create a second music catalog. It acts as a bridge between a song you can hear and your own authorized playback source.
      </p>
      {answers.map(([question, answer]) => (
        <section key={question} style={{ marginTop: 32 }}>
          <h2>{question}</h2>
          <p>{answer}</p>
        </section>
      ))}
      <section style={{ marginTop: 40 }}>
        <h2>The timing formula</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          target position = recognized song position + elapsed time after capture + user fine adjustment
        </pre>
        <p>
          That model is deliberately simple enough to audit. Improvements should be based on measured evidence, not claims that a browser has somehow negotiated peace with physics.
        </p>
      </section>
      <p style={{ marginTop: 40 }}><a href="/">Open SameBeat →</a></p>
    </main>
  );
}
