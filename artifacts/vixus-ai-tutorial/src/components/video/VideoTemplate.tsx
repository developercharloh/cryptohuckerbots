import {
  VideoCanvas,
  SafeFrame,
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

const SCENE_DURATIONS = {
  intro: 3800,
  presenter: 4300,
  pairs: 4200,
  candles: 4200,
  score: 4300,
  follow: 4100,
  outro: 3900,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '4:5';

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
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
          {currentScene === 0 && <SceneIntro key="intro" />}
          {currentScene === 1 && <ScenePresenter key="presenter" />}
          {currentScene === 2 && <ScenePairs key="pairs" />}
          {currentScene === 3 && <SceneCandles key="candles" />}
          {currentScene === 4 && <SceneScore key="score" />}
          {currentScene === 5 && <SceneFollow key="follow" />}
          {currentScene === 6 && <SceneOutro key="outro" />}
        </AnimatePresence>
        <SceneBridge currentScene={currentScene} />
      </SafeFrame>
    </VideoCanvas>
  );
}
