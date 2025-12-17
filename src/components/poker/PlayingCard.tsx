import { Card as CardType } from '@/types/poker';
import { cn } from '@/lib/utils';

interface PlayingCardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
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
  sm: 'w-8 h-11',
  md: 'w-12 h-16',
  lg: 'w-16 h-22'
};

const fontSizes = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm'
};

const suitSizes = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl'
};

export default function PlayingCard({ card, faceDown = false, size = 'md', className }: PlayingCardProps) {
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
