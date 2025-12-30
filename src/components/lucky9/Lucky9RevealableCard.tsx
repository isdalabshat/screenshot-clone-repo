import { useState } from 'react';
import { motion } from 'framer-motion';
import { parseCard, getSuitColor } from '@/lib/lucky9/deck';

interface Lucky9RevealableCardProps {
  card: string;
  hidden?: boolean;
  canReveal?: boolean;
  delay?: number;
  small?: boolean;
  onReveal?: () => void;
}

export function Lucky9RevealableCard({ 
  card, 
  hidden = false, 
  canReveal = false,
  delay = 0, 
  small = false,
  onReveal
}: Lucky9RevealableCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  
  const { rank, suit } = parseCard(card);
  const suitColor = getSuitColor(suit);
  
  const sizeClasses = small 
    ? 'w-10 h-14 text-sm' 
    : 'w-14 h-20 sm:w-16 sm:h-24 text-lg sm:text-xl';

  const showFace = !hidden || isRevealed;

  const handleClick = () => {
    if (canReveal && hidden && !isRevealed && !isRevealing) {
      setIsRevealing(true);
      // Slow reveal animation
      setTimeout(() => {
        setIsRevealed(true);
        setIsRevealing(false);
        onReveal?.();
      }, 300);
    }
  };

  // Hidden card back
  if (!showFace) {
    return (
      <motion.div
        initial={{ rotateY: 0, scale: 0.8 }}
        animate={{ 
          rotateY: isRevealing ? 90 : 0, 
          scale: 1 
        }}
        transition={{ delay, duration: 0.3 }}
        onClick={handleClick}
        className={`${sizeClasses} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-600 shadow-lg flex items-center justify-center ${canReveal ? 'cursor-pointer hover:border-yellow-400 hover:shadow-yellow-400/30' : ''}`}
      >
        <div className="w-8 h-10 rounded border border-blue-400/30 bg-blue-700/50 flex items-center justify-center relative overflow-hidden">
          <span className="text-blue-300 text-2xl">🎴</span>
          {canReveal && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
            />
          )}
        </div>
        {canReveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-5 text-[8px] text-yellow-400 whitespace-nowrap"
          >
            Tap to reveal
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Revealed card face
  return (
    <motion.div
      initial={{ rotateY: isRevealed ? -90 : 180, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ delay: isRevealed ? 0 : delay, duration: 0.4 }}
      className={`${sizeClasses} rounded-lg bg-white border-2 border-slate-200 shadow-lg flex flex-col items-center justify-center font-bold relative overflow-hidden`}
    >
      {/* Shine effect on reveal */}
      {isRevealed && (
        <motion.div
          initial={{ x: '-100%', opacity: 0.5 }}
          animate={{ x: '200%', opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200 to-transparent"
        />
      )}
      <span className={suitColor}>{rank}</span>
      <span className={`${suitColor} ${small ? 'text-lg' : 'text-2xl'}`}>{suit}</span>
    </motion.div>
  );
}
