"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls, { type Level } from "hls.js";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
  IconVolumeOff,
  IconMaximize,
  IconMinimize,
  IconSettings,
  IconRewindBackward10,
  IconRewindForward10,
} from "@tabler/icons-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  initialTime?: number;
}

interface QualityLevel {
  height: number;
  label: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const SAVE_POSITION_INTERVAL = 10000;

export function VideoPlayer({
  src,
  poster,
  onTimeUpdate,
  onEnded,
  onError,
  initialTime = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initHls = useCallback((video: HTMLVideoElement, url: string) => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels = data.levels.map((level: Level) => ({
          height: level.height,
          label: `${level.height}p`,
        }));
        setQualityLevels([{ height: 0, label: "Auto" }, ...levels]);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          const err = new Error(data.details);
          setError(data.details);
          onError?.(err);
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    }
  }, [onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    initHls(video, src);

    if (initialTime > 0) {
      video.currentTime = initialTime;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, initHls, initialTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration);
    };

    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleError = () => {
      const err = new Error("Video playback error");
      setError(err.message);
      onError?.(err);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [onTimeUpdate, onEnded, onError]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && isPlaying) {
        onTimeUpdate?.(videoRef.current.currentTime, videoRef.current.duration);
      }
    }, SAVE_POSITION_INTERVAL);

    return () => clearInterval(interval);
  }, [isPlaying, onTimeUpdate]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const progress = progressRef.current;
    const video = videoRef.current;
    if (!progress || !video || !duration) return;

    const rect = progress.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * duration);
  }, [duration, seek]);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    seek(video.currentTime + seconds);
  }, [seek]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleQualityChange = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;

    hls.currentLevel = level;
    setSelectedQuality(level);
    setShowSettings(false);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettings(false);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full"
        onClick={togglePlay}
        playsInline
      />

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div
        className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={togglePlay}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <IconPlayerPause size={32} className="text-white" />
          ) : (
            <IconPlayerPlay size={32} className="text-white" fill="currentColor" />
          )}
        </button>
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          ref={progressRef}
          className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-3 group/progress"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-white rounded-full relative"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <IconPlayerPause size={20} className="text-white" />
              ) : (
                <IconPlayerPlay size={20} className="text-white" fill="currentColor" />
              )}
            </button>

            <button
              onClick={() => skip(-10)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Rewind 10 seconds"
            >
              <IconRewindBackward10 size={18} className="text-white" />
            </button>

            <button
              onClick={() => skip(10)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Forward 10 seconds"
            >
              <IconRewindForward10 size={18} className="text-white" />
            </button>

            <div className="flex items-center gap-1 group/volume">
              <button
                onClick={toggleMute}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <IconVolumeOff size={20} className="text-white" />
                ) : (
                  <IconVolume size={20} className="text-white" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-white"
              />
            </div>

            <span className="text-white text-sm font-mono ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Settings"
              >
                <IconSettings size={20} className="text-white" />
              </button>

              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] rounded-lg shadow-xl border border-white/10 overflow-hidden min-w-[140px]">
                  <div className="p-2 border-b border-white/10">
                    <p className="text-white/60 text-xs px-2 py-1">Playback Speed</p>
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                          playbackSpeed === speed
                            ? "bg-white/20 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {qualityLevels.length > 1 && (
                    <div className="p-2">
                      <p className="text-white/60 text-xs px-2 py-1">Quality</p>
                      {qualityLevels.map((level, index) => (
                        <button
                          key={level.label}
                          onClick={() => handleQualityChange(index - 1)}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                            (index === 0 && selectedQuality === -1) || selectedQuality === index - 1
                              ? "bg-white/20 text-white"
                              : "text-white/70 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <IconMinimize size={20} className="text-white" />
              ) : (
                <IconMaximize size={20} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
