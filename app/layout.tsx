import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import "./globals.css";

const siteUrl = "https://samebeat-sync.anastaysia98.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SameBeat — Identify a Song and Join It at the Same Moment",
    template: "%s | SameBeat",
  },
  description:
    "SameBeat listens to a short sample of a nearby song, identifies the recording and its estimated position, then helps start your own authorized stream near that same moment on YouTube or supported providers.",
  applicationName: "SameBeat",
  keywords: [
    "song recognition with timestamp",
    "identify song playing nearby",
    "sync music to another device",
    "join song at same time",
    "music recognition app",
    "YouTube song sync",
  ],
  alternates: { canonical: siteUrl },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "SameBeat",
    title: "SameBeat — Join the Song Already Playing",
    description:
      "Recognize a nearby song, estimate where it is, and join your own authorized stream near the same moment.",
  },
  twitter: {
    card: "summary",
    title: "SameBeat — Join the Song Already Playing",
    description:
      "Recognize a nearby song and join your own authorized stream near the same moment.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SameBeat",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07100f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SameBeat",
  url: siteUrl,
  applicationCategory: "MultimediaApplication",
  applicationSubCategory: "Music recognition and playback synchronization",
  operatingSystem: "Web",
  browserRequirements: "Modern browser with microphone permission for recognition",
  isAccessibleForFree: true,
  description:
    "A privacy-conscious music recognition app that listens only after a user gesture, estimates the current position of a nearby recording, and helps the user start an authorized provider stream near that point.",
  featureList: [
    "short microphone capture after explicit permission",
    "recording identification",
    "estimated source timestamp",
    "network-delay catch-up",
    "YouTube embedded playback",
    "measured playback drift",
    "manual half-second calibration",
    "Spotify PKCE playback when configured and permitted",
  ],
  publisher: { "@type": "Organization", name: "SmartPickShop Holdings" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
