'use client';

import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';

export interface VideoPlayerProps {
  url: string;
  playerRef?: React.MutableRefObject<any>;
  onTimeUpdate?: (time: number) => void;
}

function extractVideoId(url: string): string | null {
  if (!url) return null;
  
  // Si c'est déjà un ID propre de 11 caractères
  if (/^[\w-]{11}$/.test(url)) {
    return url;
  }
  
  // Si c'est déjà préfixé par youtube/
  if (url.startsWith('youtube/')) {
    const id = url.substring(8);
    if (/^[\w-]{11}$/.test(id)) {
      return id;
    }
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
    /youtube-nocookie\.com\/embed\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export default function VideoPlayer({ url, playerRef, onTimeUpdate }: VideoPlayerProps) {
  const videoId = extractVideoId(url);
  const src = videoId ? `youtube/${videoId}` : url;

  return (
    <MediaPlayer
      ref={playerRef}
      src={src}
      viewType="video"
      streamType="on-demand"
      logLevel="warn"
      playsInline
      autoplay
      className="w-full h-full bg-black"
      onTimeUpdate={(e: any) => onTimeUpdate?.(e.detail?.currentTime ?? e.currentTime)}
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}

