"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const BLACK = "#000000";

const PLAYLIST = [
  {
    src: "/chapter-1/audio/cinematic-jazz-03.mp3",
    title: "Cinematic Jazz 03",
  },
  {
    src: "/chapter-1/audio/midnight-mellow.mp3",
    title: "Midnight Mellow",
  },
] as const;

const btnStyle: CSSProperties = {
  color: BLACK,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function BooksV2MusicBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const resumeAfterLoadRef = useRef(false);
  const shouldAutoPlayRef = useRef(true);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      resumeAfterLoadRef.current = true;
      setTrackIndex((i) => (i + 1) % PLAYLIST.length);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = PLAYLIST[trackIndex].src;
    audio.load();

    if (shouldAutoPlayRef.current) {
      shouldAutoPlayRef.current = false;
      // Best-effort autoplay: most browsers allow muted autoplay without gesture.
      // We then immediately try to unmute after playback starts.
      audio.muted = true;
      void audio
        .play()
        .then(() => {
          audio.muted = false;
        })
        .catch(() => setIsPlaying(false));
      return;
    }

    if (resumeAfterLoadRef.current) {
      resumeAfterLoadRef.current = false;
      void audio.play().catch(() => setIsPlaying(false));
    }
  }, [trackIndex]);

  const goPrev = () => {
    const audio = audioRef.current;
    if (!audio) return;
    resumeAfterLoadRef.current = !audio.paused;
    setTrackIndex((i) => (i - 1 + PLAYLIST.length) % PLAYLIST.length);
  };

  const goNext = () => {
    const audio = audioRef.current;
    if (!audio) return;
    resumeAfterLoadRef.current = !audio.paused;
    setTrackIndex((i) => (i + 1) % PLAYLIST.length);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  return (
    <div
      className="pointer-events-auto absolute bottom-10 left-10 z-50 flex items-center gap-3"
      role="group"
      aria-label="Background music"
      style={{ transform: "scale(0.8)", transformOrigin: "left bottom" }}
    >
      <audio ref={audioRef} preload="metadata" />

      <button
        type="button"
        onClick={goPrev}
        style={btnStyle}
        aria-label="Previous track"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 14 14"
          aria-hidden
          focusable="false"
        >
          <rect x="1" y="2" width="2" height="10" fill="currentColor" />
          <path d="M12 2 L4 7 L12 12 Z" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        onClick={togglePlay}
        style={btnStyle}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 14 14"
            aria-hidden
            focusable="false"
          >
            <rect x="3" y="2" width="3" height="10" fill="currentColor" />
            <rect x="8" y="2" width="3" height="10" fill="currentColor" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 14 14"
            aria-hidden
            focusable="false"
          >
            <path d="M4 2 L12 7 L4 12 Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={goNext}
        style={btnStyle}
        aria-label="Next track"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 14 14"
          aria-hidden
          focusable="false"
        >
          <rect x="11" y="2" width="2" height="10" fill="currentColor" />
          <path d="M2 2 L10 7 L2 12 Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
