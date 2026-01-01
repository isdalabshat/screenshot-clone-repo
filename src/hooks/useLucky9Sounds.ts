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
  | 'showdown'
  | 'countdown'
  | 'timerLow'
  | 'naturalReveal'
  | 'chipStack'
  | 'bigWin'
  | 'spectatorJoin'
  | 'clockTick';

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

  const playChord = useCallback((frequencies: number[], duration: number, type: OscillatorType = 'sine', volume = 0.15) => {
    frequencies.forEach((freq, i) => {
      setTimeout(() => playTone(freq, duration, type, volume), i * 30);
    });
  }, [playTone]);

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
        // Shuffle sound - multiple quick rustles with deeper tone
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            playNoise(0.05, 0.1);
            playTone(150 + Math.random() * 100, 0.03, 'triangle', 0.05);
          }, i * 40);
        }
        break;
        
      case 'hirit':
        // Drawing card sound - exciting upward sweep
        playNoise(0.1, 0.15);
        playTone(300, 0.08, 'sawtooth', 0.15);
        setTimeout(() => playTone(450, 0.08, 'sawtooth', 0.12), 50);
        setTimeout(() => playTone(600, 0.1, 'sine', 0.18), 100);
        setTimeout(() => playNoise(0.06, 0.1), 150);
        break;
        
      case 'good':
        // Stand sound - solid confirmation with bass
        playTone(250, 0.05, 'triangle', 0.15);
        playTone(500, 0.1, 'sine', 0.22);
        setTimeout(() => playTone(700, 0.15, 'sine', 0.2), 80);
        break;
        
      case 'bet':
        // Chip stacking sound - multiple chips falling
        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            playTone(280 + i * 40, 0.04, 'square', 0.08);
            playNoise(0.02, 0.05);
          }, i * 25);
        }
        break;
        
      case 'betAccepted':
        // Positive confirmation sound - triumphant
        playTone(523, 0.1, 'sine', 0.22);
        setTimeout(() => playTone(659, 0.1, 'sine', 0.22), 80);
        setTimeout(() => playTone(784, 0.18, 'sine', 0.25), 160);
        setTimeout(() => playNoise(0.05, 0.08), 200);
        break;
        
      case 'betRejected':
        // Negative sound - descending with buzz
        playTone(350, 0.12, 'sawtooth', 0.12);
        setTimeout(() => playTone(250, 0.15, 'sawtooth', 0.1), 80);
        setTimeout(() => playTone(180, 0.2, 'sawtooth', 0.08), 160);
        break;
        
      case 'win':
        // Victory fanfare - full chord progression
        playChord([523, 659, 784], 0.15, 'sine', 0.2);
        setTimeout(() => playChord([587, 740, 880], 0.15, 'sine', 0.22), 150);
        setTimeout(() => playChord([659, 784, 1047], 0.25, 'sine', 0.25), 300);
        setTimeout(() => {
          playTone(1047, 0.4, 'sine', 0.3);
          playNoise(0.1, 0.1);
        }, 500);
        break;
        
      case 'bigWin':
        // Huge win sound - multi-layered celebration
        playChord([523, 659, 784], 0.2, 'sine', 0.25);
        setTimeout(() => {
          playChord([659, 784, 988], 0.2, 'sine', 0.28);
          playNoise(0.08, 0.12);
        }, 180);
        setTimeout(() => playChord([784, 988, 1175], 0.25, 'sine', 0.3), 360);
        setTimeout(() => {
          playTone(1319, 0.5, 'sine', 0.35);
          playNoise(0.15, 0.15);
        }, 550);
        for (let i = 0; i < 5; i++) {
          setTimeout(() => playNoise(0.03, 0.08), 700 + i * 80);
        }
        break;
        
      case 'lose':
        // Sad descending tone with resonance
        playTone(400, 0.2, 'sine', 0.15);
        setTimeout(() => playTone(350, 0.2, 'sine', 0.12), 120);
        setTimeout(() => playTone(280, 0.25, 'sine', 0.1), 240);
        setTimeout(() => playTone(200, 0.3, 'triangle', 0.08), 400);
        break;
        
      case 'natural':
        // Special natural 9 sound - triumphant with sparkle
        playChord([659, 784, 988], 0.1, 'sine', 0.25);
        setTimeout(() => playChord([784, 988, 1175], 0.12, 'sine', 0.28), 100);
        setTimeout(() => {
          playTone(1319, 0.15, 'sine', 0.32);
          playNoise(0.08, 0.15);
        }, 200);
        setTimeout(() => playTone(1568, 0.25, 'sine', 0.28), 320);
        // Sparkle effect
        for (let i = 0; i < 4; i++) {
          setTimeout(() => playTone(2000 + i * 200, 0.05, 'sine', 0.1), 400 + i * 50);
        }
        break;
        
      case 'naturalReveal':
        // Dramatic reveal for natural 9
        playNoise(0.15, 0.2);
        playTone(200, 0.1, 'sawtooth', 0.15);
        setTimeout(() => {
          playChord([523, 784, 1047], 0.2, 'sine', 0.3);
        }, 150);
        setTimeout(() => {
          playTone(1319, 0.3, 'sine', 0.35);
          for (let i = 0; i < 6; i++) {
            setTimeout(() => playTone(1800 + i * 150, 0.04, 'sine', 0.12), i * 40);
          }
        }, 350);
        break;
        
      case 'turn':
        // Your turn notification - attention grabbing
        playTone(660, 0.08, 'sine', 0.25);
        setTimeout(() => playTone(880, 0.08, 'sine', 0.22), 80);
        setTimeout(() => playTone(1100, 0.12, 'sine', 0.2), 160);
        break;
        
      case 'showdown':
        // Dramatic showdown reveal
        playNoise(0.15, 0.25);
        playTone(150, 0.2, 'sawtooth', 0.15);
        setTimeout(() => playTone(300, 0.15, 'sawtooth', 0.18), 100);
        setTimeout(() => playTone(450, 0.15, 'sawtooth', 0.2), 200);
        setTimeout(() => {
          playTone(600, 0.25, 'sine', 0.22);
          playNoise(0.1, 0.15);
        }, 300);
        break;
        
      case 'countdown':
        // Timer tick sound
        playTone(800, 0.05, 'sine', 0.15);
        break;
        
      case 'timerLow':
        // Warning - time running out
        playTone(600, 0.08, 'square', 0.2);
        setTimeout(() => playTone(500, 0.08, 'square', 0.18), 100);
        break;
        
      case 'chipStack':
        // Chips being stacked/collected
        for (let i = 0; i < 6; i++) {
          setTimeout(() => {
            playTone(200 + i * 30, 0.03, 'triangle', 0.1);
            playNoise(0.015, 0.04);
          }, i * 35);
        }
        break;
        
      case 'spectatorJoin':
        // Subtle join sound
        playTone(400, 0.1, 'sine', 0.1);
        setTimeout(() => playTone(500, 0.1, 'sine', 0.08), 100);
        break;
        
      case 'clockTick':
        // Clock ticking sound - deep mechanical clock tick like a grandfather clock
        playTone(180, 0.06, 'triangle', 0.2);
        setTimeout(() => playTone(120, 0.04, 'sine', 0.15), 30);
        setTimeout(() => playNoise(0.02, 0.06), 50);
        break;
    }
  }, [playTone, playNoise, playChord]);

  // Play multiple deal sounds for card distribution
  const playDealSequence = useCallback((cardCount: number, delayBetween = 180) => {
    for (let i = 0; i < cardCount; i++) {
      setTimeout(() => playSound('deal'), i * delayBetween);
    }
  }, [playSound]);

  return { playSound, playDealSequence };
}
