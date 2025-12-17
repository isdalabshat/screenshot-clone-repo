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
          'flex flex-col items-center gap-2 transition-all duration-300',
          player.isCurrentPlayer && !player.isFolded && 'scale-105'
        )}
      >
        {/* Hole Cards */}
        {hasCards && !player.isFolded && (
          <div className="flex gap-1 mb-1">
            {shouldShowFaceDown ? (
              // Show face-down cards for opponents
              <>
                <PlayingCard faceDown size="sm" animationDelay={0} />
                <PlayingCard faceDown size="sm" animationDelay={100} />
              </>
            ) : (
              // Show actual cards for current user or at showdown
              cardsToShow.map((card, i) => (
                <PlayingCard 
                  key={i} 
                  card={card}
                  faceDown={false}
                  size="sm"
                  animationDelay={i * 100}
                />
              ))
            )}
          </div>
        )}

        {/* Player Avatar */}
        <div 
          className={cn(
            'w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg border-2 transition-all duration-300',
            player.isFolded 
              ? 'bg-muted/50 border-muted text-muted-foreground opacity-50' 
              : player.isCurrentPlayer 
                ? 'bg-emerald-900 border-emerald-400 ring-4 ring-emerald-400/50 animate-pulse' 
                : isCurrentUser 
                  ? 'bg-blue-900 border-blue-400' 
                  : 'bg-slate-800 border-slate-600'
          )}
        >
          <span className="font-bold text-sm truncate max-w-[70px] text-foreground">
            {player.username}
          </span>
          <span className="text-xs text-yellow-400 font-mono">
            {player.stack.toLocaleString()}
          </span>
        </div>

        {/* Position badges */}
        <div className="flex gap-1 flex-wrap justify-center">
          {player.isDealer && (
            <Badge className="bg-white text-black text-xs px-1.5 py-0">D</Badge>
          )}
          {player.isSmallBlind && (
            <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0">SB</Badge>
          )}
          {player.isBigBlind && (
            <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0">BB</Badge>
          )}
          {player.isAllIn && (
            <Badge className="bg-red-500 text-white text-xs py-0">ALL IN</Badge>
          )}
          {player.isFolded && (
            <Badge className="bg-gray-600 text-white text-xs py-0">FOLDED</Badge>
          )}
        </div>

        {/* Current bet */}
        {player.currentBet > 0 && !player.isFolded && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
            <div className="bg-yellow-500/90 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              {player.currentBet}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
