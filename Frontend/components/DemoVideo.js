import React, { useEffect } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';

// Loops a demo clip muted and reports the playback position (ms) so the
// backend can run detection on the exact frame being shown.
export default function DemoVideo({ uri, positionRef, style }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.08;
    p.play();
  });

  useEffect(() => {
    positionRef.current = 0;
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      positionRef.current = Math.round(currentTime * 1000);
    });
    return () => sub.remove();
  }, [player, positionRef]);

  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />;
}
