import { useCallback, useRef } from 'react';

type Lucky9SoundType = 
  | 'deal' 
  | 'cardFlip' 
  | 'shuffle' 
  | 'hirit' 
  | 'good' 
  | 'bet' 
  | 'betAccepted' 
  | 'betRejected' 
  | 'win' 
  | 'lose' 
  | 'natural' 
  | 'turn' 
  | 'showdown';

export function useLucky9Sounds() {
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

  const playSound = useCallback((sound: Lucky9SoundType) => {
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
        
      case 'hirit':
        // Drawing card sound - upward tone
        playNoise(0.08, 0.12);
        playTone(400, 0.1, 'sine', 0.2);
        setTimeout(() => playTone(600, 0.1, 'sine', 0.15), 80);
        break;
        
      case 'good':
        // Stand sound - confirmation double beep
        playTone(600, 0.08, 'sine', 0.2);
        setTimeout(() => playTone(800, 0.12, 'sine', 0.18), 100);
        break;
        
      case 'bet':
        // Chip stacking sound
        playTone(300, 0.05, 'square', 0.1);
        setTimeout(() => playTone(400, 0.05, 'square', 0.12), 30);
        setTimeout(() => playTone(350, 0.05, 'square', 0.1), 60);
        break;
        
      case 'betAccepted':
        // Positive confirmation sound
        playTone(523, 0.1, 'sine', 0.2);
        setTimeout(() => playTone(784, 0.15, 'sine', 0.22), 100);
        break;
        
      case 'betRejected':
        // Negative sound
        playTone(300, 0.15, 'sine', 0.18);
        setTimeout(() => playTone(200, 0.2, 'sine', 0.15), 100);
        break;
        
      case 'win':
        // Victory fanfare
        playTone(523, 0.15, 'sine', 0.3);
        setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 120);
        setTimeout(() => playTone(784, 0.25, 'sine', 0.35), 240);
        setTimeout(() => playTone(1047, 0.4, 'sine', 0.3), 400);
        break;
        
      case 'lose':
        // Sad descending tone
        playTone(400, 0.2, 'sine', 0.15);
        setTimeout(() => playTone(300, 0.2, 'sine', 0.12), 150);
        setTimeout(() => playTone(200, 0.3, 'sine', 0.1), 300);
        break;
        
      case 'natural':
        // Special natural 9 sound - triumphant
        playTone(523, 0.1, 'sine', 0.25);
        setTimeout(() => playTone(659, 0.1, 'sine', 0.25), 80);
        setTimeout(() => playTone(784, 0.1, 'sine', 0.3), 160);
        setTimeout(() => playTone(1047, 0.15, 'sine', 0.35), 240);
        setTimeout(() => playTone(1319, 0.25, 'sine', 0.3), 350);
        break;
        
      case 'turn':
        // Your turn notification
        playTone(660, 0.1, 'sine', 0.25);
        setTimeout(() => playTone(880, 0.15, 'sine', 0.2), 100);
        break;
        
      case 'showdown':
        // Dramatic showdown reveal
        playNoise(0.1, 0.2);
        playTone(200, 0.15, 'sawtooth', 0.12);
        setTimeout(() => playTone(400, 0.15, 'sawtooth', 0.15), 100);
        setTimeout(() => playTone(600, 0.2, 'sawtooth', 0.18), 200);
        break;
    }
  }, [playTone, playNoise]);

  // Play multiple deal sounds for card distribution
  const playDealSequence = useCallback((cardCount: number, delayBetween = 200) => {
    for (let i = 0; i < cardCount; i++) {
      setTimeout(() => playSound('deal'), i * delayBetween);
    }
  }, [playSound]);

  return { playSound, playDealSequence };
}
