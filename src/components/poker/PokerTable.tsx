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

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4]">
      {/* Table Surface with Premium Felt */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute inset-6 rounded-[50%/40%] poker-felt border-[10px] border-amber-900/90 shadow-2xl shadow-black/50"
        style={{
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4), 0 0 40px rgba(0,0,0,0.5)'
        }}
      >
        {/* Table Rail Highlight */}
        <div className="absolute -inset-[10px] rounded-[50%/40%] border-4 border-amber-700/30 pointer-events-none" />
        
        {/* Inner felt pattern */}
        <div className="absolute inset-0 rounded-[50%/40%] opacity-20 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        
        {/* JD Club Logo */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-primary/30 font-bold text-lg tracking-widest">
          JD CLUB
        </div>

        {/* Center area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 pt-8">
          {/* Hand counter */}
          <div className="bg-black/50 px-3 py-1 rounded-full text-[10px] text-primary font-medium border border-primary/30">
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
                  'px-4 py-1.5 rounded-full text-xs font-bold shadow-lg',
                  turnTimeLeft !== null && turnTimeLeft <= 10 
                    ? 'bg-destructive text-destructive-foreground animate-pulse' 
                    : 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground'
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
            animate={{ scale: pot > 0 ? [1, 1.03, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className="bg-black/70 px-5 py-2 rounded-full backdrop-blur-sm border border-yellow-500/50 shadow-lg shadow-yellow-500/20"
          >
            <span className="text-yellow-400 font-bold text-xl flex items-center gap-2">
              <span className="text-2xl">💰</span>
              {pot.toLocaleString()}
            </span>
          </motion.div>

          {/* Side pots display */}
          <SidePotDisplay sidePots={sidePots} />

          {/* Community Cards */}
          <div className="flex gap-1.5 flex-wrap justify-center max-w-[220px] min-h-[56px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div 
                key={i}
                initial={{ rotateY: 180, opacity: 0, y: -50 }}
                animate={{ 
                  rotateY: i < visibleCardCount && communityCards[i] ? 0 : 180,
                  opacity: i < visibleCardCount && communityCards[i] ? 1 : 0.2,
                  y: 0
                }}
                transition={{ duration: 0.5, delay: i * 0.15, type: 'spring' }}
              >
                {i < visibleCardCount && communityCards[i] ? (
                  <PlayingCard card={communityCards[i]} size="sm" />
                ) : (
                  <div className="w-9 h-13 rounded border border-dashed border-primary/20 bg-black/20" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Game status indicator */}
          {gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-black/60 px-4 py-1 rounded-full text-primary text-xs font-bold uppercase tracking-wider border border-primary/30"
            >
              {gameStatus}
            </motion.div>
          )}
        </div>
      </motion.div>

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