import { Player, Card, Game } from '@/types/poker';
import { cn } from '@/lib/utils';
import PlayingCard from './PlayingCard';
import { Badge } from '@/components/ui/badge';
import { evaluateHand } from '@/lib/poker/handEvaluator';
import CountdownTimer from './CountdownTimer';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerSeatProps {
  player?: Player;
  position: number;
  isCurrentUser?: boolean;
  showCards?: boolean;
  hideMyCards?: boolean;
  communityCards?: Card[];
  gameStatus?: Game['status'];
  myCards?: Card[];
  isWinner?: boolean;
  turnTimeLeft?: number | null;
  activeEmoji?: string | null;
}

// Optimized positions - spread out more to avoid overlaps on mobile
const positionStyles: Record<number, string> = {
  0: 'bottom-[2%] left-1/2 -translate-x-1/2', // Bottom center - current user
  1: 'bottom-[15%] left-[2%]',
  2: 'left-[0%] top-[38%]',
  3: 'top-[8%] left-[8%]',
  4: 'top-[0%] left-[32%]',
  5: 'top-[0%] right-[32%]',
  6: 'top-[8%] right-[8%]',
  7: 'right-[0%] top-[38%]',
  8: 'bottom-[15%] right-[2%]',
};

const getVisibleCommunityCards = (status: string | undefined, communityCards: Card[]): Card[] => {
  if (!communityCards) return [];
  switch (status) {
    case 'preflop': return [];
    case 'flop': return communityCards.slice(0, 3);
    case 'turn': return communityCards.slice(0, 4);
    case 'river':
    case 'showdown': return communityCards;
    default: return [];
  }
};

export default function PlayerSeat({ 
  player, 
  position, 
  isCurrentUser = false, 
  showCards = false,
  hideMyCards = false,
  communityCards = [],
  gameStatus,
  myCards = [],
  isWinner = false,
  turnTimeLeft = null,
  activeEmoji = null
}: PlayerSeatProps) {
  if (!player) {
    return (
      <div className={cn('absolute z-10', positionStyles[position])}>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/30 border-2 border-dashed border-slate-600/30 flex items-center justify-center">
          <span className="text-slate-600 text-[7px] sm:text-[8px]">{position + 1}</span>
        </div>
      </div>
    );
  }

  const showMyCards = isCurrentUser && myCards.length > 0 && !player.isFolded;
  const showFaceDownCards = !isCurrentUser && player.hasHiddenCards && !showCards && !player.isFolded;
  const showFaceUpCards = !isCurrentUser && showCards && player.holeCards.length > 0 && !player.isFolded;

  const visibleCommunity = getVisibleCommunityCards(gameStatus, communityCards);
  const handRank = showMyCards ? evaluateHand(myCards, visibleCommunity) : null;


  // Current user cards: horizontal layout with cards on left
  // Other players: cards on top of avatar (vertical layout)

  const CurrentUserCards = () => (
    showMyCards ? (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex gap-0.5 bg-black/80 backdrop-blur-sm rounded-lg p-1 border border-primary/40 shadow-lg shadow-primary/20">
          {myCards.map((card) => (
            <div key={`my-${card.suit}-${card.rank}`}>
              <PlayingCard card={card} size="sm" />
            </div>
          ))}
        </div>
        {handRank && handRank.name && (
          <div className="gold-shimmer text-black px-2 py-0.5 rounded text-[7px] sm:text-[8px] font-bold whitespace-nowrap shadow-md">
            {handRank.name}
          </div>
        )}
      </div>
    ) : null
  );

  const OpponentCards = () => (
    !isCurrentUser && !player.isFolded && (showFaceDownCards || showFaceUpCards) ? (
      <div className="flex gap-0.5 justify-center mb-0.5">
        {showFaceUpCards ? (
          player.holeCards.map((card, i) => (
            <div key={`${card.suit}-${card.rank}`}>
              <PlayingCard card={card} size="xs" />
            </div>
          ))
        ) : (
          <>
            <PlayingCard faceDown size="xs" />
            <PlayingCard faceDown size="xs" />
          </>
        )}
      </div>
    ) : null
  );

  const AvatarSection = () => (
    <div className="flex flex-col items-center gap-0.5">
      {/* Avatar with enhanced turn indicator and countdown */}
      <div className="relative">
        {/* Emoji above avatar */}
        <AnimatePresence>
          {activeEmoji && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: -10 }}
              className="absolute -top-7 sm:-top-8 left-1/2 -translate-x-1/2 z-30"
            >
              <div className="text-2xl sm:text-3xl drop-shadow-lg animate-bounce">
                {activeEmoji}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div 
          className={cn(
            'w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg border-2 sm:border-3 transition-all relative',
            player.isFolded 
              ? 'bg-slate-700/50 border-slate-600 opacity-40' 
              : isWinner
                ? 'bg-gradient-to-br from-yellow-400 to-amber-500 border-yellow-300 ring-4 ring-yellow-400/50 winner-highlight'
                : player.isCurrentPlayer 
                  ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-400' 
                  : isCurrentUser 
                    ? 'bg-gradient-to-br from-secondary to-secondary/80 border-secondary' 
                    : 'bg-slate-700 border-slate-500'
          )}
        >
          <span className="text-xs sm:text-sm">{isWinner ? '🏆' : isCurrentUser ? '👤' : '🎭'}</span>
          {/* Turn indicator badge */}
          {player.isCurrentPlayer && !player.isFolded && !isWinner && (
            <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
              <span className="text-[6px] sm:text-[8px]">▶</span>
            </div>
          )}
          {/* Winner badge */}
          {isWinner && (
            <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-[6px] sm:text-[8px]">★</span>
            </div>
          )}
        </div>
        {/* Countdown timer around avatar */}
        {player.isCurrentPlayer && !player.isFolded && turnTimeLeft !== null && turnTimeLeft > 0 && (
          <CountdownTimer timeLeft={turnTimeLeft} maxTime={30} size={44} />
        )}
      </div>
      
      {/* Name & Stack */}
      <div className={cn(
        'rounded-lg px-1.5 sm:px-2 py-0.5 text-center min-w-[50px] sm:min-w-[55px] backdrop-blur-sm',
        player.isCurrentPlayer && !player.isFolded 
          ? 'bg-primary/90 border border-primary' 
          : 'bg-slate-900/90 border border-slate-700/50'
      )}>
        <div className={cn(
          'font-semibold text-[8px] sm:text-[9px] truncate max-w-[50px] sm:max-w-[55px]',
          isCurrentUser ? 'text-secondary' : 'text-foreground'
        )}>
          {isCurrentUser ? 'You' : player.username}
        </div>
        <div className="text-[8px] sm:text-[9px] text-yellow-400 font-mono font-bold">
          {player.stack.toLocaleString()}
        </div>
      </div>

      {/* Position badges */}
      <div className="flex gap-0.5">
        {player.isDealer && (
          <Badge className="bg-white text-black text-[5px] sm:text-[6px] px-1 py-0 h-3 sm:h-3.5 font-bold shadow-md">D</Badge>
        )}
        {player.isSmallBlind && (
          <Badge className="bg-blue-500 text-white text-[5px] sm:text-[6px] px-1 py-0 h-3 sm:h-3.5 font-bold shadow-md">SB</Badge>
        )}
        {player.isBigBlind && (
          <Badge className="bg-orange-500 text-white text-[5px] sm:text-[6px] px-1 py-0 h-3 sm:h-3.5 font-bold shadow-md">BB</Badge>
        )}
      </div>

      {/* Status badges */}
      {(player.isAllIn || player.isFolded || player.isSittingOut) && (
        <Badge className={cn(
          'text-[6px] sm:text-[7px] px-1 sm:px-1.5 py-0 h-3.5 sm:h-4 font-bold',
          player.isAllIn ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/50' 
            : player.isSittingOut ? 'bg-amber-600 text-white' 
            : 'bg-slate-600 text-white'
        )}>
          {player.isAllIn ? 'ALL IN' : player.isSittingOut ? 'SITTING OUT' : 'FOLD'}
        </Badge>
      )}

    </div>
  );

  return (
    <div className={cn('absolute z-10', positionStyles[position])}>
      {isCurrentUser ? (
        // Current user: horizontal layout with cards on left
        <div className="flex items-center gap-1.5 sm:gap-2">
          <CurrentUserCards />
          <AvatarSection />
        </div>
      ) : (
        // Other players: vertical layout with cards on top
        <div className="flex flex-col items-center">
          <OpponentCards />
          <AvatarSection />
        </div>
      )}
    </div>
  );
}
