import { useCallback, useRef } from 'react';

type SoundType = 'deal' | 'check' | 'bet' | 'fold' | 'win' | 'turn' | 'allIn' | 'chip';

// Using Web Audio API for sounds
export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) => {
    try {
      const ctx = getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gainNode.gain.value = volume;
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Sound not available');
    }
  }, [getContext]);

  const playSound = useCallback((sound: SoundType) => {
    switch (sound) {
      case 'deal':
        playTone(800, 0.1, 'sine', 0.2);
        setTimeout(() => playTone(600, 0.1, 'sine', 0.2), 50);
        break;
      case 'check':
        playTone(500, 0.15, 'triangle', 0.2);
        break;
      case 'bet':
        playTone(400, 0.1, 'square', 0.15);
        playTone(500, 0.1, 'square', 0.15);
        break;
      case 'fold':
        playTone(300, 0.2, 'sine', 0.1);
        break;
      case 'win':
        playTone(523, 0.15, 'sine', 0.3);
        setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 150);
        setTimeout(() => playTone(784, 0.3, 'sine', 0.3), 300);
        break;
      case 'turn':
        playTone(440, 0.15, 'sine', 0.25);
        break;
      case 'allIn':
        playTone(600, 0.1, 'sawtooth', 0.2);
        setTimeout(() => playTone(800, 0.1, 'sawtooth', 0.2), 100);
        setTimeout(() => playTone(1000, 0.2, 'sawtooth', 0.2), 200);
        break;
      case 'chip':
        playTone(1200, 0.05, 'sine', 0.1);
        break;
    }
  }, [playTone]);

  return { playSound };
}
