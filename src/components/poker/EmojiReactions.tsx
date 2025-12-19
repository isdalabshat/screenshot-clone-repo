import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Emoji {
  id: string;
  emoji: string;
  name: string;
  sound: 'laugh' | 'wow' | 'angry' | 'celebrate' | 'cry' | 'thinking' | 'thumbsUp' | 'clap' | 'fire';
}

const EMOJIS: Emoji[] = [
  { id: '1', emoji: '😂', name: 'Laugh', sound: 'laugh' },
  { id: '2', emoji: '😮', name: 'Wow', sound: 'wow' },
  { id: '3', emoji: '😡', name: 'Angry', sound: 'angry' },
  { id: '4', emoji: '🎉', name: 'Celebrate', sound: 'celebrate' },
  { id: '5', emoji: '😢', name: 'Cry', sound: 'cry' },
  { id: '6', emoji: '🤔', name: 'Thinking', sound: 'thinking' },
  { id: '7', emoji: '👍', name: 'Thumbs Up', sound: 'thumbsUp' },
  { id: '8', emoji: '👏', name: 'Clap', sound: 'clap' },
  { id: '9', emoji: '🔥', name: 'Fire', sound: 'fire' },
];

interface PlayerEmoji {
  id: string;
  emoji: string;
  username: string;
  userId: string;
}

interface EmojiReactionsProps {
  tableId: string;
  userId?: string;
  username?: string;
  isJoined: boolean;
  onPlayerEmoji?: (emoji: PlayerEmoji) => void;
}

export default function EmojiReactions({ tableId, userId, username, isJoined, onPlayerEmoji }: EmojiReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playEmojiSound = useCallback((sound: Emoji['sound']) => {
    try {
      const ctx = getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different sounds for each emoji
      switch (sound) {
        case 'laugh':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(400, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
          oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
          gainNode.gain.value = 0.2;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.3);
          break;
        case 'wow':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(300, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
          gainNode.gain.value = 0.25;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        case 'angry':
          oscillator.type = 'sawtooth';
          oscillator.frequency.value = 150;
          gainNode.gain.value = 0.15;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.2);
          break;
        case 'celebrate':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(523, ctx.currentTime);
          oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
          gainNode.gain.value = 0.2;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        case 'cry':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(400, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
          gainNode.gain.value = 0.15;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        case 'thinking':
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(350, ctx.currentTime);
          oscillator.frequency.setValueAtTime(400, ctx.currentTime + 0.15);
          oscillator.frequency.setValueAtTime(350, ctx.currentTime + 0.3);
          gainNode.gain.value = 0.12;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.35);
          break;
        case 'thumbsUp':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.15);
          gainNode.gain.value = 0.18;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.25);
          break;
        case 'clap':
          // Create a clap-like sound with white noise effect
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(100, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
          gainNode.gain.value = 0.3;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.1);
          // Second clap
          setTimeout(() => {
            try {
              const osc2 = ctx.createOscillator();
              const gain2 = ctx.createGain();
              osc2.connect(gain2);
              gain2.connect(ctx.destination);
              osc2.type = 'square';
              osc2.frequency.value = 80;
              gain2.gain.value = 0.25;
              gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
              osc2.start(ctx.currentTime);
              osc2.stop(ctx.currentTime + 0.1);
            } catch {}
          }, 150);
          break;
        case 'fire':
          // Rising fire-like sound
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(200, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
          oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.35);
          gainNode.gain.value = 0.2;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
      }
    } catch (e) {
      console.log('Sound not available');
    }
  }, [getContext]);

  const triggerPlayerEmoji = useCallback((emoji: string, fromUsername: string, fromUserId: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    onPlayerEmoji?.({ id, emoji, username: fromUsername, userId: fromUserId });
  }, [onPlayerEmoji]);

  // Subscribe to realtime emoji broadcasts
  useEffect(() => {
    const channel = supabase.channel(`emoji-${tableId}`)
      .on('broadcast', { event: 'emoji' }, ({ payload }) => {
        if (payload.userId !== userId) {
          triggerPlayerEmoji(payload.emoji, payload.username, payload.userId);
          const emojiData = EMOJIS.find(e => e.emoji === payload.emoji);
          if (emojiData) {
            playEmojiSound(emojiData.sound);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, userId, triggerPlayerEmoji, playEmojiSound]);

  const sendEmoji = async (emoji: Emoji) => {
    if (!userId || !username || cooldown) return;
    
    setCooldown(true);
    setIsOpen(false);
    
    // Play sound locally
    playEmojiSound(emoji.sound);
    
    // Trigger emoji on own avatar
    triggerPlayerEmoji(emoji.emoji, username, userId);
    
    // Broadcast to others
    await supabase.channel(`emoji-${tableId}`).send({
      type: 'broadcast',
      event: 'emoji',
      payload: { emoji: emoji.emoji, username, userId }
    });
    
    // Reset cooldown after 2 seconds
    setTimeout(() => setCooldown(false), 2000);
  };

  // Spectators can see emojis but not send them
  const canSendEmojis = isJoined && userId && username;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {canSendEmojis && (
        <>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
            disabled={cooldown}
            className={cn(
              'w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-600 shadow-lg flex items-center justify-center border-2 border-primary/50 transition-all',
              cooldown && 'opacity-50 cursor-not-allowed',
              isOpen && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            )}
          >
            <span className="text-lg">{cooldown ? '⏳' : '😀'}</span>
          </motion.button>

          {/* Emoji Picker - positioned above the button */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="absolute bottom-14 right-0 bg-card/95 backdrop-blur-lg rounded-xl p-2 shadow-xl border border-primary/30"
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {EMOJIS.map((emoji) => (
                    <motion.button
                      key={emoji.id}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => sendEmoji(emoji)}
                      className="w-9 h-9 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center transition-colors"
                      title={emoji.name}
                    >
                      <span className="text-lg">{emoji.emoji}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
