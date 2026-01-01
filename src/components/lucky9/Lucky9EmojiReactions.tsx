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

interface Lucky9EmojiReactionsProps {
  tableId: string;
  userId?: string;
  username?: string;
  isJoined: boolean;
  onPlayerEmoji?: (emoji: PlayerEmoji) => void;
}

export default function Lucky9EmojiReactions({ tableId, userId, username, isJoined, onPlayerEmoji }: Lucky9EmojiReactionsProps) {
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
        case 'fire':
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(200, ctx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
          gainNode.gain.value = 0.2;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        default:
          oscillator.type = 'sine';
          oscillator.frequency.value = 440;
          gainNode.gain.value = 0.15;
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.log('Sound not available');
    }
  }, [getContext]);

  const triggerPlayerEmoji = useCallback((emoji: string, fromUsername: string, fromUserId: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    onPlayerEmoji?.({ id, emoji, username: fromUsername, userId: fromUserId });
  }, [onPlayerEmoji]);

  useEffect(() => {
    const channel = supabase.channel(`lucky9-emoji-${tableId}`)
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
    
    playEmojiSound(emoji.sound);
    triggerPlayerEmoji(emoji.emoji, username, userId);
    
    await supabase.channel(`lucky9-emoji-${tableId}`).send({
      type: 'broadcast',
      event: 'emoji',
      payload: { emoji: emoji.emoji, username, userId }
    });
    
    setTimeout(() => setCooldown(false), 2000);
  };

  const canSendEmojis = isJoined && userId && username;

  return (
    <div className="fixed bottom-32 right-4 z-40">
      {canSendEmojis && (
        <>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
            disabled={cooldown}
            className={cn(
              'w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-700 shadow-lg flex items-center justify-center border-2 border-green-400/50 transition-all',
              cooldown && 'opacity-50 cursor-not-allowed',
              isOpen && 'ring-2 ring-green-400 ring-offset-2 ring-offset-background'
            )}
          >
            <span className="text-base">{cooldown ? '⏳' : '😀'}</span>
          </motion.button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="absolute bottom-12 right-0 bg-card/95 backdrop-blur-lg rounded-xl p-2 shadow-xl border border-green-500/30 min-w-[120px]"
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {EMOJIS.map((emoji) => (
                    <motion.button
                      key={emoji.id}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => sendEmoji(emoji)}
                      className="w-8 h-8 rounded-lg bg-slate-800/70 hover:bg-slate-700 flex items-center justify-center transition-colors"
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
