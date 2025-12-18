import { Player, Card, Game } from '@/types/poker';
import PlayerSeat from './PlayerSeat';
import PlayingCard from './PlayingCard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PokerTableProps {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentUserId?: string;
  gameStatus?: Game['status'];
  turnTimeLeft?: number | null;
  handsPlayed?: number;
  maxHands?: number;
}

const getVisibleCards = (status: Game['status'] | undefined): number => {
  switch (status) {
    case 'flop': return 3;
    case 'turn': return 4;
    case 'river': return 5;
    case 'showdown': return 5;
    default: return 0;
  }
};

export default function PokerTableComponent({ 
  players, 
  communityCards, 
  pot, 
  currentUserId,
  gameStatus,
  turnTimeLeft,
  handsPlayed = 0,
  maxHands = 50
}: PokerTableProps) {
  const seats: (Player | undefined)[] = Array(9).fill(undefined);
  players.forEach(player => {
    if (player.position >= 0 && player.position < 9) {
      seats[player.position] = player;
    }
  });

  const visibleCardCount = getVisibleCards(gameStatus);
  const isShowdown = gameStatus === 'showdown';
  const currentTurnPlayer = players.find(p => p.isCurrentPlayer);

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[3/4]">
      {/* Table Surface */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute inset-4 rounded-[45%/35%] bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 border-[8px] border-amber-900 shadow-2xl"
      >
        {/* Table felt pattern */}
        <div className="absolute inset-0 rounded-[45%/35%] opacity-10 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
        
        {/* Center area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          {/* Hand counter */}
          <div className="bg-black/40 px-2 py-0.5 rounded text-[10px] text-emerald-300">
            Hand {handsPlayed}/{maxHands}
          </div>

          {/* Current turn indicator with animation */}
          <AnimatePresence mode="wait">
            {currentTurnPlayer && gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
              <motion.div
                key={currentTurnPlayer.userId}
                initial={{ scale: 0.8, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-bold shadow-lg',
                  turnTimeLeft !== null && turnTimeLeft <= 10 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                )}
              >
                🎯 {currentTurnPlayer.username}'s Turn
                {turnTimeLeft !== null && (
                  <span className={cn(
                    'ml-2 font-mono',
                    turnTimeLeft <= 5 && 'text-yellow-300'
                  )}>
                    {turnTimeLeft}s
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pot display */}
          <motion.div 
            animate={{ scale: pot > 0 ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className="bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm border border-yellow-500/40 shadow-lg"
          >
            <span className="text-yellow-400 font-bold text-lg flex items-center gap-1">
              💰 {pot.toLocaleString()}
            </span>
          </motion.div>

          {/* Community Cards */}
          <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div 
                key={i}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ 
                  rotateY: i < visibleCardCount && communityCards[i] ? 0 : 180,
                  opacity: i < visibleCardCount && communityCards[i] ? 1 : 0.3
                }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                {i < visibleCardCount && communityCards[i] ? (
                  <PlayingCard card={communityCards[i]} size="sm" />
                ) : (
                  <div className="w-8 h-12 rounded border border-dashed border-emerald-500/30" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Game status indicator */}
          {gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-emerald-900/80 px-3 py-1 rounded-full text-emerald-300 text-xs font-semibold uppercase tracking-wider border border-emerald-500/30"
            >
              {gameStatus}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Player Seats - don't show cards for current user (shown separately at bottom) */}
      {seats.map((player, position) => (
        <PlayerSeat
          key={position}
          player={player}
          position={position}
          isCurrentUser={player?.userId === currentUserId}
          showCards={isShowdown}
          hideMyCards={player?.userId === currentUserId}
          communityCards={communityCards}
          gameStatus={gameStatus}
        />
      ))}
    </div>
  );
}
