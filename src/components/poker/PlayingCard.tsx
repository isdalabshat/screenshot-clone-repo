import { Card as CardType } from '@/types/poker';
import { cn } from '@/lib/utils';

interface PlayingCardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animationDelay?: number;
}

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const suitColors = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-foreground',
  spades: 'text-foreground'
};

const sizeClasses = {
  sm: 'w-10 h-14 text-xs',
  md: 'w-14 h-20 text-sm',
  lg: 'w-20 h-28 text-lg'
};

export default function PlayingCard({ card, faceDown = false, size = 'md', className, animationDelay = 0 }: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div 
        className={cn(
          'rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-600 shadow-lg flex items-center justify-center',
          sizeClasses[size],
          'animate-fade-in',
          className
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <div className="text-blue-400 text-2xl">🃏</div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'rounded-lg bg-white border border-gray-300 shadow-lg flex flex-col justify-between p-1',
        sizeClasses[size],
        'animate-scale-in',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className={cn('font-bold', suitColors[card.suit])}>
        <div>{card.rank}</div>
        <div className="text-lg">{suitSymbols[card.suit]}</div>
      </div>
      <div className={cn('text-2xl self-center', suitColors[card.suit])}>
        {suitSymbols[card.suit]}
      </div>
      <div className={cn('font-bold rotate-180', suitColors[card.suit])}>
        <div>{card.rank}</div>
        <div className="text-lg">{suitSymbols[card.suit]}</div>
      </div>
    </div>
  );
}
