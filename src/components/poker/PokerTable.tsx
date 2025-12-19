import { Player, Card, Game } from '@/types/poker';
import PlayerSeat from './PlayerSeat';
import PlayingCard from './PlayingCard';
import SidePotDisplay, { SidePot } from './SidePotDisplay';
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
  myCards?: Card[];
  winnerId?: string;
  sidePots?: SidePot[];
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

const getRotatedPosition = (actualPosition: number, userPosition: number): number => {
  const offset = userPosition;
  return (actualPosition - offset + 9) % 9;
};

// Bet positions around the table - closer to center for visibility
const betPositions: Record<number, string> = {
  0: 'bottom-[28%] left-1/2 -translate-x-1/2',
  1: 'bottom-[32%] left-[18%]',
  2: 'left-[18%] top-[42%]',
  3: 'top-[25%] left-[22%]',
  4: 'top-[20%] left-[40%]',
  5: 'top-[20%] right-[40%]',
  6: 'top-[25%] right-[22%]',
  7: 'right-[18%] top-[42%]',
  8: 'bottom-[32%] right-[18%]',
};

export default function PokerTableComponent({ 
  players, 
  communityCards, 
  pot, 
  currentUserId,
  gameStatus,
  turnTimeLeft,
  handsPlayed = 0,
  maxHands = 50,
  myCards = [],
  winnerId,
  sidePots = []
}: PokerTableProps) {
  const currentUserPlayer = players.find(p => p.userId === currentUserId);
  const userPosition = currentUserPlayer?.position ?? 0;

  const seats: (Player | undefined)[] = Array(9).fill(undefined);
  players.forEach(player => {
    if (player.position >= 0 && player.position < 9) {
      const displayPosition = getRotatedPosition(player.position, userPosition);
      seats[displayPosition] = player;
    }
  });

  const visibleCardCount = getVisibleCards(gameStatus);
  const isShowdown = gameStatus === 'showdown';
  const currentTurnPlayer = players.find(p => p.isCurrentPlayer);

  // Calculate total bets for display
  const totalBets = players.reduce((sum, p) => sum + (p.currentBet || 0), 0);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4]">
      {/* Table Surface with Premium Felt */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute inset-6 rounded-[50%/40%] poker-felt border-[12px] border-amber-900/90 shadow-2xl shadow-black/50"
        style={{
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5), 0 0 50px rgba(0,0,0,0.6), inset 0 0 30px rgba(16, 185, 129, 0.1)'
        }}
      >
        {/* Table Rail Highlight */}
        <div className="absolute -inset-[12px] rounded-[50%/40%] border-4 border-amber-700/40 pointer-events-none" />
        <div className="absolute -inset-[8px] rounded-[50%/40%] border-2 border-amber-600/20 pointer-events-none" />
        
        {/* Inner felt pattern */}
        <div className="absolute inset-0 rounded-[50%/40%] opacity-30 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(0,0,0,0.5)_100%)]" />
        
        {/* JD Club Logo */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-primary/40 font-bold text-lg tracking-[0.3em] uppercase">
          JD CLUB
        </div>

        {/* Center area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 pt-8">
          {/* Hand counter */}
          <div className="bg-black/60 px-4 py-1.5 rounded-full text-[10px] text-primary font-semibold border border-primary/40 shadow-lg">
            Hand {handsPlayed}/{maxHands}
          </div>

          {/* Current turn indicator */}
          <AnimatePresence mode="wait">
            {currentTurnPlayer && gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
              <motion.div
                key={currentTurnPlayer.userId}
                initial={{ scale: 0.8, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-bold shadow-lg border',
                  turnTimeLeft !== null && turnTimeLeft <= 10 
                    ? 'bg-destructive/90 text-destructive-foreground border-destructive animate-pulse' 
                    : 'bg-gradient-to-r from-primary to-emerald-600 text-primary-foreground border-primary/50'
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
            className="bg-gradient-to-br from-black/80 to-black/60 px-6 py-3 rounded-2xl backdrop-blur-sm border-2 border-yellow-500/60 shadow-xl shadow-yellow-500/30"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-yellow-500/80 uppercase tracking-wider font-semibold">Total Pot</span>
              <span className="text-yellow-400 font-bold text-2xl flex items-center gap-2">
                <span className="text-3xl">💰</span>
                {pot.toLocaleString()}
              </span>
            </div>
          </motion.div>

          {/* Side pots display */}
          <SidePotDisplay sidePots={sidePots} />

          {/* Community Cards */}
          <div className="flex gap-1.5 flex-wrap justify-center max-w-[240px] min-h-[60px] bg-black/30 rounded-xl p-2 border border-primary/20">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div 
                key={i}
                initial={{ rotateY: 180, opacity: 0, y: -50 }}
                animate={{ 
                  rotateY: i < visibleCardCount && communityCards[i] ? 0 : 180,
                  opacity: i < visibleCardCount && communityCards[i] ? 1 : 0.3,
                  y: 0
                }}
                transition={{ duration: 0.5, delay: i * 0.15, type: 'spring' }}
              >
                {i < visibleCardCount && communityCards[i] ? (
                  <PlayingCard card={communityCards[i]} size="sm" />
                ) : (
                  <div className="w-9 h-13 rounded-md border border-dashed border-primary/30 bg-black/30" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Game status indicator */}
          {gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-gradient-to-r from-primary/20 to-emerald-600/20 px-5 py-1.5 rounded-full text-primary text-xs font-bold uppercase tracking-widest border border-primary/40 shadow-lg"
            >
              {gameStatus}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Player Bets on the Table */}
      {seats.map((player, displayPosition) => {
        if (!player || player.currentBet <= 0 || player.isFolded) return null;
        
        return (
          <motion.div
            key={`bet-${displayPosition}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn('absolute z-20', betPositions[displayPosition])}
          >
            <div className="flex items-center gap-1 bg-gradient-to-br from-amber-500 to-yellow-600 text-black px-2.5 py-1 rounded-full shadow-lg shadow-amber-500/40 border-2 border-yellow-300/50">
              <span className="text-sm">🪙</span>
              <span className="font-bold text-xs">{player.currentBet.toLocaleString()}</span>
            </div>
          </motion.div>
        );
      })}

      {/* Player Seats */}
      {seats.map((player, displayPosition) => (
        <PlayerSeat
          key={displayPosition}
          player={player}
          position={displayPosition}
          isCurrentUser={player?.userId === currentUserId}
          showCards={isShowdown}
          hideMyCards={false}
          communityCards={communityCards}
          gameStatus={gameStatus}
          myCards={player?.userId === currentUserId ? myCards : undefined}
          isWinner={winnerId ? player?.userId === winnerId : false}
          turnTimeLeft={player?.isCurrentPlayer ? turnTimeLeft : null}
        />
      ))}
    </div>
  );
}