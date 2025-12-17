import { Player, Card } from '@/types/poker';
import { cn } from '@/lib/utils';
import PlayingCard from './PlayingCard';
import { Badge } from '@/components/ui/badge';

interface PlayerSeatProps {
  player?: Player;
  position: number;
  isCurrentUser?: boolean;
  showCards?: boolean;
  myCards?: Card[]; // Current user's cards passed separately for security
}

// Position configurations for 9 players around an oval table
const positionStyles: Record<number, string> = {
  0: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  1: 'bottom-[15%] left-[5%]',
  2: 'top-1/2 left-0 -translate-y-1/2 -translate-x-1/2',
  3: 'top-[15%] left-[5%]',
  4: 'top-0 left-1/3 -translate-y-1/2',
  5: 'top-0 right-1/3 -translate-y-1/2',
  6: 'top-[15%] right-[5%]',
  7: 'top-1/2 right-0 -translate-y-1/2 translate-x-1/2',
  8: 'bottom-[15%] right-[5%]',
};

export default function PlayerSeat({ 
  player, 
  position, 
  isCurrentUser = false, 
  showCards = false,
  myCards = []
}: PlayerSeatProps) {
  if (!player) {
    return (
      <div className={cn('absolute', positionStyles[position])}>
        <div className="w-24 h-24 rounded-full bg-muted/30 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Empty</span>
        </div>
      </div>
    );
  }

  // For current user, use myCards passed from parent (secure)
  // For other players, only show cards at showdown
  const cardsToShow = isCurrentUser ? myCards : (showCards ? player.holeCards : []);
  const hasCards = isCurrentUser ? myCards.length > 0 : (player.hasHiddenCards || player.holeCards.length > 0);
  const shouldShowFaceDown = !isCurrentUser && hasCards && !showCards;

  return (
    <div className={cn('absolute', positionStyles[position])}>
      <div 
        className={cn(
          'flex flex-col items-center gap-1 transition-all duration-300',
          player.isCurrentPlayer && !player.isFolded && 'scale-105'
        )}
      >
        {/* Hole Cards - above avatar */}
        {hasCards && !player.isFolded && (
          <div className="flex gap-1">
            {shouldShowFaceDown ? (
              <>
                <PlayingCard faceDown size="sm" />
                <PlayingCard faceDown size="sm" />
              </>
            ) : (
              cardsToShow.map((card, i) => (
                <PlayingCard key={i} card={card} size="sm" />
              ))
            )}
          </div>
        )}

        {/* Player Info Container - separate from avatar */}
        <div className="flex flex-col items-center">
          {/* Avatar Circle */}
          <div 
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-300',
              player.isFolded 
                ? 'bg-muted/50 border-muted opacity-50' 
                : player.isCurrentPlayer 
                  ? 'bg-emerald-900 border-emerald-400 ring-2 ring-emerald-400/50' 
                  : isCurrentUser 
                    ? 'bg-blue-900 border-blue-400' 
                    : 'bg-slate-800 border-slate-600'
            )}
          >
            <span className="text-2xl">👤</span>
          </div>
          
          {/* Name & Stack - below avatar, never overlapping */}
          <div className="mt-1 text-center bg-black/60 rounded px-2 py-0.5">
            <div className="font-semibold text-xs text-white truncate max-w-[80px]">
              {player.username}
            </div>
            <div className="text-xs text-yellow-400 font-mono">
              {player.stack.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Position badges - horizontal row */}
        <div className="flex gap-0.5 flex-wrap justify-center max-w-[100px]">
          {player.isDealer && (
            <Badge className="bg-white text-black text-[10px] px-1 py-0 h-4">D</Badge>
          )}
          {player.isSmallBlind && (
            <Badge className="bg-blue-500 text-white text-[10px] px-1 py-0 h-4">SB</Badge>
          )}
          {player.isBigBlind && (
            <Badge className="bg-orange-500 text-white text-[10px] px-1 py-0 h-4">BB</Badge>
          )}
          {player.isAllIn && (
            <Badge className="bg-red-500 text-white text-[10px] px-1 py-0 h-4">ALL IN</Badge>
          )}
          {player.isFolded && (
            <Badge className="bg-gray-600 text-white text-[10px] px-1 py-0 h-4">FOLD</Badge>
          )}
        </div>

        {/* Current bet chip */}
        {player.currentBet > 0 && !player.isFolded && (
          <div className="bg-yellow-500 text-black px-2 py-0.5 rounded-full text-[10px] font-bold shadow">
            {player.currentBet}
          </div>
        )}
      </div>
    </div>
  );
}
