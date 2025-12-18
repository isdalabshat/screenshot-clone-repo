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

// Optimized positions for better visual balance - current user always at bottom center
const positionStyles: Record<number, string> = {
  0: 'bottom-[8%] left-1/2 -translate-x-1/2', // Bottom center - current user (adjusted up)
  1: 'bottom-[20%] left-[5%]',
  2: 'left-[2%] top-[35%]',
  3: 'top-[10%] left-[10%]',
  4: 'top-[2%] left-[35%]',
  5: 'top-[2%] right-[35%]',
  6: 'top-[10%] right-[10%]',
  7: 'right-[2%] top-[35%]',
  8: 'bottom-[20%] right-[5%]',
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
        <div className="w-10 h-10 rounded-full bg-slate-800/30 border-2 border-dashed border-slate-600/30 flex items-center justify-center">
          <span className="text-slate-600 text-[8px]">{position + 1}</span>
        </div>
      </div>
    );
  }

  const showMyCards = isCurrentUser && myCards.length > 0 && !player.isFolded;
  const showFaceDownCards = !isCurrentUser && player.hasHiddenCards && !showCards && !player.isFolded;
  const showFaceUpCards = !isCurrentUser && showCards && player.holeCards.length > 0 && !player.isFolded;

  const visibleCommunity = getVisibleCommunityCards(gameStatus, communityCards);
  const handRank = showMyCards ? evaluateHand(myCards, visibleCommunity) : null;


  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: position * 0.05, type: 'spring', stiffness: 200 }}
      className={cn('absolute z-10', positionStyles[position])}
    >
      {/* Horizontal layout: Cards on left, Avatar/Info on right */}
      <div className="flex items-center gap-2">
        {/* Cards Section - LEFT side */}
        <div className="flex items-center">
          {/* Current User's Cards */}
          {showMyCards && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex gap-0.5 bg-black/80 backdrop-blur-sm rounded-lg p-1 border border-primary/40 shadow-lg shadow-primary/20">
                {myCards.map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ rotateY: 180, scale: 0.5, y: -50 }}
                    animate={{ rotateY: 0, scale: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.15, type: 'spring' }}
                    className="card-deal"
                  >
                    <PlayingCard card={card} size="sm" />
                  </motion.div>
                ))}
              </div>
              {handRank && handRank.name && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="gold-shimmer text-black px-2 py-0.5 rounded text-[8px] font-bold whitespace-nowrap shadow-md"
                >
                  {handRank.name}
                </motion.div>
              )}
            </div>
          )}

          {/* Opponent's Cards */}
          {!isCurrentUser && !player.isFolded && (showFaceDownCards || showFaceUpCards) && (
            <div className="flex gap-0.5">
              {showFaceUpCards ? (
                player.holeCards.map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ rotateY: 180, y: -30 }}
                    animate={{ rotateY: 0, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                  >
                    <PlayingCard card={card} size="xs" />
                  </motion.div>
                ))
              ) : (
                <>
                  <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PlayingCard faceDown size="xs" />
                  </motion.div>
                  <motion.div
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <PlayingCard faceDown size="xs" />
                  </motion.div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Avatar and Info Section - RIGHT side */}
        <div className="flex flex-col items-center gap-0.5">
          {/* Avatar with enhanced turn indicator */}
          <motion.div 
            animate={player.isCurrentPlayer ? { 
              scale: [1, 1.12, 1],
              boxShadow: [
                '0 0 0 0 rgba(34, 197, 94, 0)',
                '0 0 20px 8px rgba(34, 197, 94, 0.6)',
                '0 0 0 0 rgba(34, 197, 94, 0)'
              ]
            } : {}}
            transition={{ repeat: player.isCurrentPlayer ? Infinity : 0, duration: 1.2 }}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-3 transition-all relative',
              player.isFolded 
                ? 'bg-slate-700/50 border-slate-600 opacity-40' 
                : player.isCurrentPlayer 
                  ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-400 ring-4 ring-green-400/50' 
                  : isCurrentUser 
                    ? 'bg-gradient-to-br from-secondary to-secondary/80 border-secondary' 
                    : 'bg-slate-700 border-slate-500'
            )}
          >
            <span className="text-sm">{isCurrentUser ? '👤' : '🎭'}</span>
            {/* Turn indicator badge */}
            {player.isCurrentPlayer && !player.isFolded && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white"
              >
                <span className="text-[8px]">▶</span>
              </motion.div>
            )}
          </motion.div>
          
          {/* Name & Stack */}
          <div className={cn(
            'rounded-lg px-2 py-0.5 text-center min-w-[55px] backdrop-blur-sm',
            player.isCurrentPlayer && !player.isFolded 
              ? 'bg-primary/90 border border-primary' 
              : 'bg-slate-900/90 border border-slate-700/50'
          )}>
            <div className={cn(
              'font-semibold text-[9px] truncate max-w-[55px]',
              isCurrentUser ? 'text-secondary' : 'text-foreground'
            )}>
              {isCurrentUser ? 'You' : player.username}
            </div>
            <div className="text-[9px] text-yellow-400 font-mono font-bold">
              {player.stack.toLocaleString()}
            </div>
          </div>

          {/* Position badges */}
          <div className="flex gap-0.5">
            {player.isDealer && (
              <Badge className="bg-white text-black text-[6px] px-1 py-0 h-3.5 font-bold shadow-md">D</Badge>
            )}
            {player.isSmallBlind && (
              <Badge className="bg-blue-500 text-white text-[6px] px-1 py-0 h-3.5 font-bold shadow-md">SB</Badge>
            )}
            {player.isBigBlind && (
              <Badge className="bg-orange-500 text-white text-[6px] px-1 py-0 h-3.5 font-bold shadow-md">BB</Badge>
            )}
          </div>

          {/* Status badges */}
          {(player.isAllIn || player.isFolded) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <Badge className={cn(
                'text-[7px] px-1.5 py-0 h-4 font-bold',
                player.isAllIn ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/50' : 'bg-slate-600 text-white'
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
              className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-black px-2 py-0.5 rounded-full text-[8px] font-bold shadow-lg chip-stack"
            >
              {player.currentBet}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}