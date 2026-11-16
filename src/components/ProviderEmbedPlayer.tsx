import { useEffect, useMemo, useRef } from 'react';
import { Radio } from 'lucide-react';
import { extractYouTubeId, usePlayerStore } from '../store/playerStore';

function buildEmbedUrl(mediaUrl: string, provider: 'youtube' | 'soundcloud'): string | null {
  if (provider === 'youtube') {
    const videoId = extractYouTubeId(mediaUrl);
    if (!videoId) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      enablejsapi: '1',
      controls: '1',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
    });
    if (origin) {
      params.set('origin', origin);
    }
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }

  const params = new URLSearchParams({
    url: mediaUrl,
    color: '#B84A2E',
    auto_play: 'false',
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'false',
    visual: 'true',
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export function ProviderEmbedPlayer() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const seekRequestSeconds = usePlayerStore((s) => s.seekRequestSeconds);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const clearSeekRequest = usePlayerStore((s) => s.clearSeekRequest);

  const embedSrc = useMemo(() => {
    if (!currentTrack) return null;
    return buildEmbedUrl(currentTrack.mediaUrl, currentTrack.provider);
  }, [currentTrack]);

  // Helper to send postMessage commands to YouTube or SoundCloud iframe
  const postToWidget = (payload: Record<string, unknown>) => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !currentTrack) return;
    const targetOrigin =
      currentTrack.provider === 'youtube'
        ? 'https://www.youtube.com'
        : 'https://w.soundcloud.com';
    try {
      targetWindow.postMessage(JSON.stringify(payload), targetOrigin);
    } catch {
      // Ignore cross-origin frame readiness race
    }
  };

  // Sync play/pause state to active provider widget
  useEffect(() => {
    if (!currentTrack || !embedSrc) return;
    if (currentTrack.provider === 'youtube') {
      postToWidget({
        event: 'command',
        func: isPlaying ? 'playVideo' : 'pauseVideo',
        args: [],
      });
    } else {
      postToWidget({ method: isPlaying ? 'play' : 'pause' });
    }
  }, [isPlaying, currentTrack, embedSrc]);

  // Sync master volume & mute state to active provider widget
  useEffect(() => {
    if (!currentTrack || !embedSrc) return;
    const effectiveVolume = isMuted ? 0 : volume;
    if (currentTrack.provider === 'youtube') {
      postToWidget({
        event: 'command',
        func: isMuted ? 'mute' : 'unMute',
        args: [],
      });
      postToWidget({
        event: 'command',
        func: 'setVolume',
        args: [effectiveVolume],
      });
    } else {
      postToWidget({ method: 'setVolume', value: effectiveVolume });
    }
  }, [volume, isMuted, currentTrack, embedSrc]);

  // Handle explicit scrubber seek requests
  useEffect(() => {
    if (seekRequestSeconds === null || !currentTrack || !embedSrc) return;
    if (currentTrack.provider === 'youtube') {
      postToWidget({
        event: 'command',
        func: 'seekTo',
        args: [seekRequestSeconds, true],
      });
    } else {
      postToWidget({ method: 'seekTo', value: seekRequestSeconds * 1000 });
    }
    clearSeekRequest();
  }, [seekRequestSeconds, currentTrack, embedSrc, clearSeekRequest]);

  // Listen to postMessage events from YouTube and SoundCloud widgets
  useEffect(() => {
    if (!currentTrack) return;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.youtube.com' &&
        event.origin !== 'https://w.soundcloud.com'
      ) {
        return;
      }

      let data: Record<string, unknown>;
      if (typeof event.data === 'string') {
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
      } else if (event.data && typeof event.data === 'object') {
        data = event.data as Record<string, unknown>;
      } else {
        return;
      }

      // YouTube IFrame API messages
      if (event.origin === 'https://www.youtube.com') {
        if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
          const info = data.info as Record<string, unknown>;
          if (typeof info.currentTime === 'number') {
            const dur =
              typeof info.duration === 'number' ? info.duration : undefined;
            setProgress(info.currentTime, dur);
          }
          if (info.playerState === 1) {
            setPlaying(true);
          } else if (info.playerState === 2) {
            setPlaying(false);
          } else if (info.playerState === 0) {
            skipNext();
          }
        }
      }

      // SoundCloud Widget API messages
      if (event.origin === 'https://w.soundcloud.com') {
        if (data.method === 'ready') {
          postToWidget({ method: 'addEventListener', value: 'play' });
          postToWidget({ method: 'addEventListener', value: 'pause' });
          postToWidget({ method: 'addEventListener', value: 'finish' });
          postToWidget({ method: 'addEventListener', value: 'playProgress' });
          postToWidget({ method: 'setVolume', value: isMuted ? 0 : volume });
          if (isPlaying) {
            postToWidget({ method: 'play' });
          }
        } else if (data.method === 'play') {
          setPlaying(true);
        } else if (data.method === 'pause') {
          setPlaying(false);
        } else if (data.method === 'finish') {
          skipNext();
        } else if (
          data.method === 'playProgress' &&
          data.value &&
          typeof data.value === 'object'
        ) {
          const val = data.value as Record<string, unknown>;
          if (typeof val.currentPosition === 'number') {
            setProgress(val.currentPosition / 1000);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentTrack, isPlaying, isMuted, volume, setPlaying, setProgress, skipNext]);

  const handleIframeLoad = () => {
    if (!currentTrack) return;
    if (currentTrack.provider === 'youtube') {
      postToWidget({ event: 'listening', id: currentTrack.id });
      postToWidget({
        event: 'command',
        func: 'setVolume',
        args: [isMuted ? 0 : volume],
      });
      if (isPlaying) {
        postToWidget({ event: 'command', func: 'playVideo', args: [] });
      }
    } else {
      postToWidget({ method: 'addEventListener', value: 'ready' });
      postToWidget({ method: 'addEventListener', value: 'playProgress' });
      postToWidget({ method: 'addEventListener', value: 'finish' });
    }
  };

  if (!currentTrack || !embedSrc) {
    return (
      <div className="w-[200px] h-[200px] rounded-lg border border-[#DDD5C7] bg-[#1F1B18]/85 text-[#FCF9F4]/80 p-3 flex flex-col items-center justify-center text-center opacity-80">
        <Radio className="w-6 h-6 opacity-70 mb-2" />
        <p className="text-[11px] font-medium">No track selected</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-[200px] h-[200px] rounded-lg border border-[#DDD5C7] bg-[#1F1B18] overflow-hidden opacity-85 hover:opacity-100 transition-opacity shadow-md"
      title={`ToS-compliant ${currentTrack.provider} embed`}
    >
      <iframe
        ref={iframeRef}
        key={`${currentTrack.id}-${embedSrc}`}
        src={embedSrc}
        title={`${currentTrack.title} (${currentTrack.provider} player)`}
        width={200}
        height={200}
        allow="autoplay; encrypted-media"
        onLoad={handleIframeLoad}
        className="w-[200px] h-[200px] border-0"
      />
    </div>
  );
}
