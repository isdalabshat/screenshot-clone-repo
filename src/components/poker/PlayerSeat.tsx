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

// Position configurations for 9 players around an oval table
const positionStyles: Record<number, string> = {
  0: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3',
  1: 'bottom-[10%] left-[8%]',
  2: 'top-1/2 left-0 -translate-y-1/2 -translate-x-1/4',
  3: 'top-[10%] left-[8%]',
  4: 'top-0 left-1/3 -translate-y-1/3',
  5: 'top-0 right-1/3 -translate-y-1/3',
  6: 'top-[10%] right-[8%]',
  7: 'top-1/2 right-0 -translate-y-1/2 translate-x-1/4',
  8: 'bottom-[10%] right-[8%]',
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
      <div className={cn('absolute', positionStyles[position])}>
        <div className="w-20 h-20 rounded-full bg-slate-800/50 border-2 border-dashed border-slate-600/50 flex items-center justify-center">
          <span className="text-slate-500 text-xs">Seat {position + 1}</span>
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
    <div className={cn('absolute', positionStyles[position])}>
      <div className="flex flex-col items-center gap-1">
        {/* Hole Cards */}
        {hasCards && !player.isFolded && (
          <div className="flex gap-0.5 mb-1">
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

        {/* Hand Rank - only visible to card owner */}
        {isCurrentUser && handRank && handRank.name && !player.isFolded && (
          <div className="bg-purple-600/90 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase">
            {handRank.name}
          </div>
        )}

        {/* Avatar */}
        <div 
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-3 transition-all',
            player.isFolded 
              ? 'bg-slate-700/50 border-slate-600 opacity-50' 
              : player.isCurrentPlayer 
                ? 'bg-emerald-800 border-emerald-400 ring-2 ring-emerald-400/60 animate-pulse' 
                : isCurrentUser 
                  ? 'bg-blue-800 border-blue-400' 
                  : 'bg-slate-700 border-slate-500'
          )}
        >
          <span className="text-xl">👤</span>
        </div>
        
        {/* Name & Stack */}
        <div className="bg-slate-900/90 rounded px-2 py-0.5 text-center min-w-[70px]">
          <div className="font-medium text-[10px] text-white truncate max-w-[70px]">
            {player.username}
          </div>
          <div className="text-[10px] text-yellow-400 font-mono">
            {player.stack.toLocaleString()}
          </div>
        </div>

        {/* Position badges */}
        <div className="flex gap-0.5">
          {player.isDealer && (
            <Badge className="bg-white text-black text-[8px] px-1 py-0 h-3.5 font-bold">D</Badge>
          )}
          {player.isSmallBlind && (
            <Badge className="bg-blue-500 text-white text-[8px] px-1 py-0 h-3.5 font-bold">SB</Badge>
          )}
          {player.isBigBlind && (
            <Badge className="bg-orange-500 text-white text-[8px] px-1 py-0 h-3.5 font-bold">BB</Badge>
          )}
        </div>

        {/* Status badges */}
        {(player.isAllIn || player.isFolded) && (
          <Badge className={cn(
            'text-[8px] px-1 py-0 h-3.5 font-bold',
            player.isAllIn ? 'bg-red-500 text-white' : 'bg-slate-600 text-white'
          )}>
            {player.isAllIn ? 'ALL IN' : 'FOLD'}
          </Badge>
        )}

        {/* Current bet chip */}
        {player.currentBet > 0 && !player.isFolded && (
          <div className="bg-yellow-500 text-black px-2 py-0.5 rounded-full text-[9px] font-bold">
            {player.currentBet}
          </div>
        )}
      </div>
    </div>
  );
}
