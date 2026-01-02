import { useState } from 'react';
import { motion } from 'framer-motion';
import { parseCard, getSuitColor } from '@/lib/lucky9/deck';

interface Lucky9RevealableCardProps {
  card: string;
  hidden?: boolean;
  canReveal?: boolean;
  delay?: number;
  small?: boolean;
  extraSmall?: boolean; // Even smaller for other players' cards
  onReveal?: () => void;
}

// Unified card back design
function CardBack({ small = false, extraSmall = false, canReveal = false }: { small?: boolean; extraSmall?: boolean; canReveal?: boolean }) {
  // Reduced sizes: extraSmall for global view, small for POV
  const sizeClasses = extraSmall
    ? 'w-5 h-7'  // Smaller for global view
    : small 
      ? 'w-7 h-10'  // Smaller for POV
      : 'w-12 h-16 sm:w-14 sm:h-20';

  return (
    <div className={`${sizeClasses} rounded-md bg-gradient-to-br from-red-700 via-red-800 to-red-900 border border-red-500 shadow-md flex items-center justify-center relative overflow-hidden ${canReveal ? 'cursor-pointer hover:border-yellow-400 hover:shadow-yellow-400/30' : ''}`}>
      <div className="absolute inset-0.5 border border-red-400/30 rounded-sm" />
      <div className="w-full h-full flex items-center justify-center">
        <div className={`text-red-400/50 font-bold ${extraSmall ? 'text-[6px]' : small ? 'text-[8px]' : 'text-sm'}`}>L9</div>
      </div>
      {canReveal && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
        />
      )}
    </div>
  );
}

export function Lucky9RevealableCard({ 
  card, 
  hidden = false, 
  canReveal = false,
  delay = 0, 
  small = false,
  extraSmall = false,
  onReveal
}: Lucky9RevealableCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  
  const { rank, suit } = parseCard(card);
  const suitColor = getSuitColor(suit);
  
  // Reduced sizes: extraSmall for global view, small for POV
  const sizeClasses = extraSmall
    ? 'w-5 h-7 text-[8px]'  // Smaller for global view
    : small 
      ? 'w-7 h-10 text-[10px]'  // Smaller for POV
      : 'w-12 h-16 sm:w-14 sm:h-20 text-base sm:text-lg';

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

  // Hidden card back - unified red design
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
        className="relative"
      >
        <CardBack small={small} extraSmall={extraSmall} canReveal={canReveal} />
        {canReveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-yellow-400 whitespace-nowrap"
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
      className={`${sizeClasses} rounded-md bg-white border border-slate-200 shadow-md flex flex-col items-center justify-center font-bold relative overflow-hidden`}
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
      <span className={`${suitColor} ${extraSmall ? 'text-[10px]' : small ? 'text-sm' : 'text-xl'}`}>{suit}</span>
    </motion.div>
  );
}
