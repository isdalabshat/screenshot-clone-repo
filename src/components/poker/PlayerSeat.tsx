import { Player, Card } from '@/types/poker';
import { cn } from '@/lib/utils';
import PlayingCard from './PlayingCard';
import { Badge } from '@/components/ui/badge';
import { evaluateHand } from '@/lib/poker/handEvaluator';

interface PlayerSeatProps {
  player?: Player;
  position: number;
  isCurrentUser?: boolean;
  showCards?: boolean;
  myCards?: Card[];
  communityCards?: Card[];
  gameStatus?: string;
}

// Portrait layout positions for 9 players (3/4 aspect ratio)
const positionStyles: Record<number, string> = {
  0: 'bottom-0 left-1/2 -translate-x-1/2',           // Bottom center (user)
  1: 'bottom-[12%] left-[5%]',                        // Bottom left
  2: 'left-0 top-[40%] -translate-x-[10%]',           // Middle left
  3: 'top-[15%] left-[5%]',                           // Top left
  4: 'top-0 left-[30%] -translate-y-[20%]',           // Top left-center
  5: 'top-0 right-[30%] -translate-y-[20%]',          // Top right-center
  6: 'top-[15%] right-[5%]',                          // Top right
  7: 'right-0 top-[40%] translate-x-[10%]',           // Middle right
  8: 'bottom-[12%] right-[5%]',                       // Bottom right
};

export default function PlayerSeat({ 
  player, 
  position, 
  isCurrentUser = false, 
  showCards = false,
  myCards = [],
  communityCards = [],
  gameStatus = 'preflop'
}: PlayerSeatProps) {
  if (!player) {
    return (
      <div className={cn('absolute z-10', positionStyles[position])}>
        <div className="w-12 h-12 rounded-full bg-slate-800/50 border-2 border-dashed border-slate-600/50 flex items-center justify-center">
          <span className="text-slate-500 text-[8px]">{position + 1}</span>
        </div>
      </div>
    );
  }

  // For current user, use myCards passed from parent (secure)
  const cardsToShow = isCurrentUser ? myCards : (showCards ? player.holeCards : []);
  const hasCards = isCurrentUser ? myCards.length > 0 : (player.hasHiddenCards || player.holeCards.length > 0);
  const shouldShowFaceDown = !isCurrentUser && hasCards && !showCards;

  // Calculate hand rank for current user only - based on visible community cards
  const getVisibleCommunityCards = () => {
    if (!communityCards) return [];
    switch (gameStatus) {
      case 'preflop': return [];
      case 'flop': return communityCards.slice(0, 3);
      case 'turn': return communityCards.slice(0, 4);
      case 'river':
      case 'showdown': return communityCards;
      default: return [];
    }
  };

  const visibleCommunity = getVisibleCommunityCards();
  const handRank = isCurrentUser && myCards.length > 0 
    ? evaluateHand(myCards, visibleCommunity) 
    : null;

  return (
    <div className={cn('absolute z-10', positionStyles[position])}>
      <div className="flex flex-col items-center gap-0.5">
        {/* Hole Cards */}
        {hasCards && !player.isFolded && (
          <div className="flex gap-0.5">
            {shouldShowFaceDown ? (
              <>
                <PlayingCard faceDown size="xs" />
                <PlayingCard faceDown size="xs" />
              </>
            ) : (
              cardsToShow.map((card, i) => (
                <PlayingCard key={i} card={card} size="xs" />
              ))
            )}
          </div>
        )}

        {/* Hand Rank - only visible to card owner */}
        {isCurrentUser && handRank && handRank.name && !player.isFolded && (
          <div className="bg-purple-600/90 text-white px-1.5 py-0.5 rounded text-[7px] font-bold uppercase">
            {handRank.name}
          </div>
        )}

        {/* Avatar with turn indicator */}
        <div 
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all',
            player.isFolded 
              ? 'bg-slate-700/50 border-slate-600 opacity-50' 
              : player.isCurrentPlayer 
                ? 'bg-emerald-700 border-emerald-400 ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900 animate-pulse' 
                : isCurrentUser 
                  ? 'bg-blue-800 border-blue-400' 
                  : 'bg-slate-700 border-slate-500'
          )}
        >
          <span className="text-sm">👤</span>
        </div>
        
        {/* Name & Stack */}
        <div className={cn(
          'rounded px-1.5 py-0.5 text-center min-w-[50px]',
          player.isCurrentPlayer && !player.isFolded 
            ? 'bg-emerald-800/90 border border-emerald-400' 
            : 'bg-slate-900/90'
        )}>
          <div className="font-medium text-[8px] text-white truncate max-w-[50px]">
            {player.username}
          </div>
          <div className="text-[8px] text-yellow-400 font-mono">
            {player.stack.toLocaleString()}
          </div>
        </div>

        {/* Position badges */}
        <div className="flex gap-0.5">
          {player.isDealer && (
            <Badge className="bg-white text-black text-[6px] px-1 py-0 h-3 font-bold">D</Badge>
          )}
          {player.isSmallBlind && (
            <Badge className="bg-blue-500 text-white text-[6px] px-1 py-0 h-3 font-bold">SB</Badge>
          )}
          {player.isBigBlind && (
            <Badge className="bg-orange-500 text-white text-[6px] px-1 py-0 h-3 font-bold">BB</Badge>
          )}
        </div>

        {/* Status badges */}
        {(player.isAllIn || player.isFolded) && (
          <Badge className={cn(
            'text-[6px] px-1 py-0 h-3 font-bold',
            player.isAllIn ? 'bg-red-500 text-white' : 'bg-slate-600 text-white'
          )}>
            {player.isAllIn ? 'ALL IN' : 'FOLD'}
          </Badge>
        )}

        {/* Current bet chip */}
        {player.currentBet > 0 && !player.isFolded && (
          <div className="bg-yellow-500 text-black px-1.5 py-0.5 rounded-full text-[7px] font-bold">
            {player.currentBet}
          </div>
        )}
      </div>
    </div>
  );
}
