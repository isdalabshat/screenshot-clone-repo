import { useCallback, useRef } from 'react';

type SoundType = 'deal' | 'check' | 'bet' | 'fold' | 'win' | 'turn' | 'allIn' | 'chip' | 'cardFlip' | 'shuffle' | 'potCollect';

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

  const playNoise = useCallback((duration: number, volume = 0.1) => {
    try {
      const ctx = getContext();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3000;
      
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      source.start(ctx.currentTime);
    } catch (e) {
      console.log('Noise not available');
    }
  }, [getContext]);

  const playSound = useCallback((sound: SoundType) => {
    switch (sound) {
      case 'deal':
        // Card dealing sound - quick whoosh with thud
        playNoise(0.08, 0.15);
        setTimeout(() => playTone(200, 0.05, 'sine', 0.1), 40);
        break;
      case 'cardFlip':
        // Card flip sound
        playNoise(0.06, 0.12);
        playTone(800, 0.08, 'sine', 0.15);
        break;
      case 'shuffle':
        // Shuffle sound - multiple quick rustles
        for (let i = 0; i < 6; i++) {
          setTimeout(() => playNoise(0.04, 0.08), i * 50);
        }
        break;
      case 'check':
        playTone(400, 0.1, 'triangle', 0.2);
        setTimeout(() => playTone(500, 0.1, 'triangle', 0.15), 50);
        break;
      case 'bet':
        // Chip stacking sound
        playTone(300, 0.05, 'square', 0.1);
        setTimeout(() => playTone(400, 0.05, 'square', 0.12), 30);
        setTimeout(() => playTone(350, 0.05, 'square', 0.1), 60);
        break;
      case 'fold':
        playTone(250, 0.15, 'sine', 0.1);
        setTimeout(() => playTone(200, 0.1, 'sine', 0.08), 80);
        break;
      case 'win':
        // Victory fanfare
        playTone(523, 0.15, 'sine', 0.3);
        setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 120);
        setTimeout(() => playTone(784, 0.25, 'sine', 0.35), 240);
        setTimeout(() => playTone(1047, 0.4, 'sine', 0.3), 400);
        break;
      case 'turn':
        // Your turn notification
        playTone(660, 0.1, 'sine', 0.25);
        setTimeout(() => playTone(880, 0.15, 'sine', 0.2), 100);
        break;
      case 'allIn':
        // Dramatic all-in sound
        playTone(200, 0.1, 'sawtooth', 0.15);
        setTimeout(() => playTone(400, 0.1, 'sawtooth', 0.18), 80);
        setTimeout(() => playTone(600, 0.1, 'sawtooth', 0.2), 160);
        setTimeout(() => playTone(800, 0.2, 'sawtooth', 0.22), 240);
        break;
      case 'chip':
        // Single chip sound
        playTone(1000, 0.04, 'sine', 0.12);
        setTimeout(() => playTone(1200, 0.03, 'sine', 0.1), 25);
        break;
      case 'potCollect':
        // Chips sliding to pot sound - multiple chips cascading
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            playTone(800 + i * 100, 0.06, 'sine', 0.15);
            playNoise(0.03, 0.08);
          }, i * 60);
        }
        // Final satisfying thud
        setTimeout(() => playTone(300, 0.1, 'sine', 0.2), 350);
        break;
    }
  }, [playTone, playNoise]);

  // Play multiple deal sounds for card distribution
  const playDealSequence = useCallback((cardCount: number, delayBetween = 150) => {
    for (let i = 0; i < cardCount; i++) {
      setTimeout(() => playSound('deal'), i * delayBetween);
    }
  }, [playSound]);

  return { playSound, playDealSequence };
}