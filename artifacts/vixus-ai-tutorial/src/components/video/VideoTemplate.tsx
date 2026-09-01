import { useEffect, useRef, type ComponentType } from 'react';
import {
  SafeFrame,
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence } from 'framer-motion';

import {
  SceneBridge,
  SceneCandles,
  SceneFollow,
  SceneIntro,
  SceneOutro,
  ScenePairs,
  ScenePresenter,
  SceneScore,
} from './video_scenes/Scenes';

export const SCENE_DURATIONS = {
  intro: 12300,
  presenter: 14500,
  pairs: 15000,
  candles: 13100,
  score: 13000,
  follow: 14500,
  outro: 12300,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '4:5';

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  intro: SceneIntro,
  presenter: ScenePresenter,
  pairs: ScenePairs,
  candles: SceneCandles,
  score: SceneScore,
  follow: SceneFollow,
  outro: SceneOutro,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const starts: Record<string, number> = {};
  let elapsedMs = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    starts[key] = elapsedMs / 1000;
    elapsedMs += duration;
  }
  return starts;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Math.max(
    0,
    Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey),
  );
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 1;
    audio.muted = muted;
    if (paused) {
      audio.pause();
      return;
    }

    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
        audio.currentTime = targetTime;
      }
    }

    audio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas
        aspectRatio={VIDEO_ASPECT_RATIO}
        className="vixus-video"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="drift absolute left-[-13%] top-[20%] h-[40vmin] w-[40vmin] rounded-full border border-[#8bd8ce]/10" />
          <div className="drift absolute right-[-23%] top-[-10%] h-[54vmin] w-[54vmin] rounded-full border border-[#f1c76c]/10" style={{ animationDelay: '-3s' }} />
          <div className="scan absolute left-0 top-0 h-[28%] w-full bg-gradient-to-b from-transparent via-[#8bd8ce]/[.04] to-transparent" />
        </div>
        <SafeFrame className="relative z-10">
          <AnimatePresence mode="sync">
            {SceneComponent && <SceneComponent key={currentSceneKey} />}
          </AnimatePresence>
          <SceneBridge currentScene={sceneIndex} />
        </SafeFrame>
      </VideoCanvas>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/composite_audio.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </VideoPausedContext.Provider>
  );
}
