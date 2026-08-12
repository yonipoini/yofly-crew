import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter } from 'expo-router';

interface SplashScreenProps {
  onComplete?: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const router = useRouter();
  const videoSource = require('../assets/splash-video.mp4');

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else {
        router.replace('/(tabs)');
      }
    }, 3200);

    return () => clearTimeout(timer);
  }, [router, onComplete]);

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player as any}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        nativeControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
