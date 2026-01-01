import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Crown, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Lucky9PlayerAvatarProps {
  username: string;
  isBanker?: boolean;
  isMe?: boolean;
  currentEmoji?: string | null;
  size?: 'sm' | 'md' | 'lg';
  isWinner?: boolean;
  isNaturalWinner?: boolean;
}

export function Lucky9PlayerAvatar({
  username,
  isBanker = false,
  isMe = false,
  currentEmoji,
  size = 'md',
  isWinner = false,
  isNaturalWinner = false
}: Lucky9PlayerAvatarProps) {
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    if (currentEmoji) {
      setShowEmoji(true);
      const timer = setTimeout(() => setShowEmoji(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentEmoji]);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="relative inline-flex">
      <Avatar className={cn(
        sizeClasses[size],
        'border-2 transition-all duration-300',
        isBanker 
          ? 'border-amber-500 bg-gradient-to-br from-amber-600 to-amber-800' 
          : isMe 
            ? 'border-blue-500 bg-gradient-to-br from-blue-600 to-blue-800'
            : 'border-slate-500 bg-gradient-to-br from-slate-600 to-slate-800'
      )}>
        <AvatarFallback className={cn(
          'font-bold',
          isBanker 
            ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100' 
            : isMe 
              ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-blue-100'
              : 'bg-gradient-to-br from-slate-600 to-slate-800 text-slate-100'
        )}>
          {isBanker ? (
            <Crown className={iconSizes[size]} />
          ) : (
            initials
          )}
        </AvatarFallback>
      </Avatar>

      {/* Emoji popup above avatar */}
      <AnimatePresence>
        {showEmoji && currentEmoji && (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: -10 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-20"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: 2, duration: 0.4 }}
              className="bg-slate-900/90 backdrop-blur rounded-full px-2 py-1 border border-slate-600 shadow-lg"
            >
              <span className="text-xl">{currentEmoji}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner indicator */}
      <AnimatePresence>
        {(isWinner || isNaturalWinner) && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute -top-2 -right-2 z-30"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase shadow-lg',
                isNaturalWinner 
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-400 text-white'
              )}
            >
              {isNaturalWinner ? '🏆 9!' : '🎉 WIN'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banker crown badge */}
      {isBanker && (
        <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-0.5 border border-amber-300">
          <Crown className="h-2.5 w-2.5 text-amber-900" />
        </div>
      )}

      {/* "You" indicator */}
      {isMe && !isBanker && (
        <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border border-blue-300">
          <User className="h-2.5 w-2.5 text-blue-900" />
        </div>
      )}
    </div>
  );
}
