import { Player, Card, Game } from '@/types/poker';
import { cn } from '@/lib/utils';
import PlayingCard from './PlayingCard';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { evaluateHand } from '@/lib/poker/handEvaluator';

interface PlayerSeatProps {
  player?: Player;
  position: number;
  isCurrentUser?: boolean;
  showCards?: boolean;
  hideMyCards?: boolean;
  communityCards?: Card[];
  gameStatus?: Game['status'];
  myCards?: Card[];
}

const positionStyles: Record<number, string> = {
  0: 'bottom-[2%] left-1/2 -translate-x-1/2', // Bottom center - current user
  1: 'bottom-[15%] left-[8%]',
  2: 'left-[2%] top-[40%]',
  3: 'top-[12%] left-[8%]',
  4: 'top-[2%] left-[30%]',
  5: 'top-[2%] right-[30%]',
  6: 'top-[12%] right-[8%]',
  7: 'right-[2%] top-[40%]',
  8: 'bottom-[15%] right-[8%]',
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
  myCards = []
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

  // For current user, show their cards next to the seat
  const showMyCards = isCurrentUser && myCards.length > 0 && !player.isFolded;
  // For other players, show face-down cards or face-up at showdown
  const showFaceDownCards = !isCurrentUser && player.hasHiddenCards && !showCards && !player.isFolded;
  const showFaceUpCards = !isCurrentUser && showCards && player.holeCards.length > 0 && !player.isFolded;

  // Calculate hand rank for current user
  const visibleCommunity = getVisibleCommunityCards(gameStatus, communityCards);
  const handRank = showMyCards ? evaluateHand(myCards, visibleCommunity) : null;

  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: position * 0.05, type: 'spring', stiffness: 200 }}
      className={cn('absolute z-10', positionStyles[position])}
    >
      {/* Main container - horizontal layout: cards on left, avatar/info in center */}
      <div className="flex items-center gap-2">
        {/* Current User's Cards - shown to the LEFT of their avatar */}
        {showMyCards && (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex gap-0.5 bg-black/80 backdrop-blur-sm rounded-lg p-1.5 border border-emerald-500/40 shadow-lg">
              {myCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ rotateY: 180, scale: 0.5 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                >
                  <PlayingCard card={card} size="sm" />
                </motion.div>
              ))}
            </div>
            {handRank && handRank.name && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap shadow-md"
              >
                {handRank.name}
              </motion.div>
            )}
          </div>
        )}

        {/* Player info column - avatar, name, stack */}
        <div className="flex flex-col items-center gap-0.5">

        {/* Opponent's Cards */}
        {!isCurrentUser && !player.isFolded && (showFaceDownCards || showFaceUpCards) && (
          <div className="flex gap-0.5">
            {showFaceUpCards ? (
              player.holeCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ rotateY: 180 }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <PlayingCard card={card} size="xs" />
                </motion.div>
              ))
            ) : (
              <>
                <motion.div
                  initial={{ rotateY: 180 }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <PlayingCard faceDown size="xs" />
                </motion.div>
                <motion.div
                  initial={{ rotateY: 180 }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <PlayingCard faceDown size="xs" />
                </motion.div>
              </>
            )}
          </div>
        )}

        {/* Avatar with turn indicator */}
        <motion.div 
          animate={player.isCurrentPlayer ? { 
            scale: [1, 1.1, 1],
            boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 20px 5px rgba(16, 185, 129, 0.5)', '0 0 0 0 rgba(16, 185, 129, 0)']
          } : {}}
          transition={{ repeat: player.isCurrentPlayer ? Infinity : 0, duration: 1.5 }}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all',
            player.isFolded 
              ? 'bg-slate-700/50 border-slate-600 opacity-50' 
              : player.isCurrentPlayer 
                ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 border-emerald-400 ring-2 ring-emerald-400' 
                : isCurrentUser 
                  ? 'bg-gradient-to-br from-amber-600 to-amber-800 border-amber-400' 
                  : 'bg-slate-700 border-slate-500'
          )}
        >
          <span className="text-sm">{isCurrentUser ? '👤' : '🎭'}</span>
        </motion.div>
        
        {/* Name & Stack */}
        <div className={cn(
          'rounded px-1.5 py-0.5 text-center min-w-[50px]',
          player.isCurrentPlayer && !player.isFolded 
            ? 'bg-emerald-800/90 border border-emerald-400' 
            : 'bg-slate-900/90'
        )}>
          <div className={cn(
            'font-medium text-[8px] truncate max-w-[50px]',
            isCurrentUser ? 'text-amber-300' : 'text-white'
          )}>
            {isCurrentUser ? 'You' : player.username}
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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <Badge className={cn(
              'text-[6px] px-1 py-0 h-3 font-bold',
              player.isAllIn ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-600 text-white'
            )}>
              {player.isAllIn ? 'ALL IN' : 'FOLD'}
            </Badge>
          </motion.div>
        )}

        {/* Current bet chip */}
          {player.currentBet > 0 && !player.isFolded && (
            <motion.div 
              initial={{ scale: 0, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-yellow-500 text-black px-1.5 py-0.5 rounded-full text-[7px] font-bold shadow-lg"
            >
              {player.currentBet}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
