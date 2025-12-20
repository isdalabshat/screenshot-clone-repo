import { Card as CardType } from '@/types/poker';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface PlayingCardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  flipDelay?: number;
  animate?: boolean;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const suitColors: Record<string, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900'
};

const sizeClasses = {
  xs: 'w-6 h-8',
  sm: 'w-8 h-11',
  md: 'w-12 h-16',
  lg: 'w-16 h-22'
};

const fontSizes = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm'
};

const suitSizes = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl'
};

export default function PlayingCard({ 
  card, 
  faceDown = false, 
  size = 'md', 
  className,
  flipDelay = 0,
  animate = false
}: PlayingCardProps) {
  // Face down card
  if (faceDown || !card) {
    return (
      <div 
        className={cn(
          'rounded-md bg-blue-900 border border-blue-700 flex items-center justify-center',
          sizeClasses[size],
          className
        )}
      >
        <div className="w-[80%] h-[85%] rounded-sm bg-blue-800 border border-blue-600" />
      </div>
    );
  }

  // Animated flip card
  if (animate) {
    return (
      <motion.div
        className={cn('relative preserve-3d', sizeClasses[size], className)}
        initial={{ rotateY: 180, scale: 0.8, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ 
          duration: 0.5, 
          delay: flipDelay,
          type: 'spring',
          stiffness: 200,
          damping: 20
        }}
        style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
      >
        {/* Front of card */}
        <div 
          className={cn(
            'absolute inset-0 rounded-md bg-white border border-gray-300 flex flex-col items-center justify-center backface-hidden',
            sizeClasses[size]
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <span className={cn('font-bold', fontSizes[size], suitColors[card.suit])}>
            {card.rank}
          </span>
          <span className={cn(suitSizes[size], suitColors[card.suit])}>
            {suitSymbols[card.suit]}
          </span>
        </div>
      </motion.div>
    );
  }

  // Face up card - simple clean design
  return (
    <div 
      className={cn(
        'rounded-md bg-white border border-gray-300 flex flex-col items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      <span className={cn('font-bold', fontSizes[size], suitColors[card.suit])}>
        {card.rank}
      </span>
      <span className={cn(suitSizes[size], suitColors[card.suit])}>
        {suitSymbols[card.suit]}
      </span>
    </div>
  );
}
