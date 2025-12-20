import { Player, Card, Game } from '@/types/poker';
import PlayerSeat from './PlayerSeat';
import PlayingCard from './PlayingCard';
import SidePotDisplay, { SidePot } from './SidePotDisplay';
import ChipAnimation from './ChipAnimation';
import PotCollectionAnimation from './PotCollectionAnimation';

import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useMemo } from 'react';

interface PlayerEmoji {
  id: string;
  emoji: string;
  username: string;
  userId: string;
}

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
  playerEmojis?: Map<string, string>;
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

// Bet positions - carefully positioned to avoid overlap with avatars and cards
// Position 0 (user) is placed lower, just above the user's cards but not overlapping community cards
const betPositions: Record<number, string> = {
  0: 'bottom-[22%] left-1/2 -translate-x-1/2',    // Lower - above user's cards, below community cards
  1: 'bottom-[30%] left-[20%]',                   // Above-right of seat 1
  2: 'left-[18%] top-[40%]',                      // Right of seat 2
  3: 'top-[22%] left-[24%]',                      // Below-right seat 3
  4: 'top-[14%] left-[40%]',                      // Below seat 4
  5: 'top-[14%] right-[40%]',                     // Below seat 5
  6: 'top-[22%] right-[24%]',                     // Below-left seat 6
  7: 'right-[18%] top-[40%]',                     // Left of seat 7
  8: 'bottom-[30%] right-[20%]',                  // Above-left of seat 8
};

interface ChipAnimationData {
  id: string;
  position: number;
  amount: number;
}

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
  sidePots = [],
  playerEmojis = new Map()
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

  // Track previous bets for chip animations
  const prevBetsRef = useRef<Map<string, number>>(new Map());
  const [chipAnimations, setChipAnimations] = useState<ChipAnimationData[]>([]);
  
  // Track previous game status for pot collection animation
  const prevGameStatusRef = useRef<Game['status'] | undefined>(undefined);
  const [isCollectingPot, setIsCollectingPot] = useState(false);
  const [collectingPositions, setCollectingPositions] = useState<number[]>([]);
  const [hasBetsToCollect, setHasBetsToCollect] = useState(false);
  
  // Track which cards have been revealed (for flip animation)
  const [revealedCardCount, setRevealedCardCount] = useState(0);
  const prevVisibleCardCount = useRef(0);
  

  // Detect bet changes and trigger animations
  useEffect(() => {
    const newAnimations: ChipAnimationData[] = [];
    
    players.forEach(player => {
      const prevBet = prevBetsRef.current.get(player.userId) || 0;
      const betDiff = player.currentBet - prevBet;
      
      if (betDiff > 0 && gameStatus !== 'complete' && gameStatus !== 'showdown') {
        const displayPosition = getRotatedPosition(player.position, userPosition);
        newAnimations.push({
          id: `chip-${player.userId}-${Date.now()}`,
          position: displayPosition,
          amount: betDiff
        });
      }
    });
    
    if (newAnimations.length > 0) {
      setChipAnimations(prev => [...prev, ...newAnimations]);
    }
    
    // Update tracked bets
    const newBetsMap = new Map<string, number>();
    players.forEach(p => newBetsMap.set(p.userId, p.currentBet));
    prevBetsRef.current = newBetsMap;
  }, [players, gameStatus, userPosition]);

  // Clear chip animations after they complete
  const removeChipAnimation = (id: string) => {
    setChipAnimations(prev => prev.filter(a => a.id !== id));
  };

  // Trigger pot collection animation when betting round ends - only if there were actual bets
  useEffect(() => {
    const phases: Game['status'][] = ['flop', 'turn', 'river', 'showdown'];
    const prevStatus = prevGameStatusRef.current;
    
    // Detect transition from one phase to next (betting round ended)
    if (prevStatus && gameStatus && phases.includes(gameStatus) && prevStatus !== gameStatus) {
      // Only trigger if there were actual bets to collect
      if (hasBetsToCollect) {
        // Get positions of players who had bets
        const positionsWithBets = players
          .filter(p => !p.isFolded && p.currentBet > 0)
          .map(p => getRotatedPosition(p.position, userPosition));
        
        if (positionsWithBets.length > 0) {
          setCollectingPositions(positionsWithBets);
          setIsCollectingPot(true);
        }
        setHasBetsToCollect(false);
      }
    }
    
    prevGameStatusRef.current = gameStatus;
  }, [gameStatus, players, userPosition, hasBetsToCollect]);

  // Track when there are bets to collect
  useEffect(() => {
    const totalBets = players.reduce((sum, p) => sum + p.currentBet, 0);
    if (totalBets > 0) {
      setHasBetsToCollect(true);
    }
  }, [players]);
  
  // Track card reveals for flip animation
  useEffect(() => {
    if (visibleCardCount > prevVisibleCardCount.current) {
      // New cards revealed - update with a small delay for animation
      setRevealedCardCount(prevVisibleCardCount.current);
      const timer = setTimeout(() => {
        setRevealedCardCount(visibleCardCount);
      }, 50);
      prevVisibleCardCount.current = visibleCardCount;
      return () => clearTimeout(timer);
    } else if (visibleCardCount < prevVisibleCardCount.current) {
      // New hand started - reset
      setRevealedCardCount(0);
      prevVisibleCardCount.current = visibleCardCount;
    }
  }, [visibleCardCount]);

  // Reset bets tracking when game changes phase
  useEffect(() => {
    if (gameStatus === 'preflop' || gameStatus === 'flop' || gameStatus === 'turn' || gameStatus === 'river') {
      // Reset on new round - bets are collected
      if (gameStatus !== 'preflop') {
        prevBetsRef.current = new Map();
      }
    }
  }, [gameStatus]);


  return (
    <div className="relative w-full max-w-xl mx-auto aspect-[3/4]">
      {/* Ambient glow effect */}
      <div className="absolute inset-0 bg-gradient-radial from-emerald-900/20 via-transparent to-transparent pointer-events-none" />
      
      {/* Table Surface with Premium Felt */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute inset-8 sm:inset-6 rounded-[50%/40%] poker-felt border-[12px] sm:border-[14px] border-amber-900/95 shadow-2xl"
        style={{
          boxShadow: `
            inset 0 0 100px rgba(0,0,0,0.6), 
            0 0 60px rgba(0,0,0,0.7), 
            inset 0 0 40px rgba(16, 185, 129, 0.15),
            0 8px 32px rgba(0,0,0,0.5)
          `,
          background: 'radial-gradient(ellipse at 50% 30%, #1a5d3a 0%, #0f4228 40%, #0a2e1c 100%)'
        }}
      >
        {/* Table Rail - Multi-layer wood effect */}
        <div className="absolute -inset-[12px] sm:-inset-[14px] rounded-[50%/40%] border-4 border-amber-800/60 pointer-events-none" />
        <div className="absolute -inset-[8px] sm:-inset-[10px] rounded-[50%/40%] border-2 border-amber-600/30 pointer-events-none" />
        <div className="absolute -inset-[4px] sm:-inset-[6px] rounded-[50%/40%] border border-amber-500/10 pointer-events-none" />
        
        {/* Felt texture overlay */}
        <div className="absolute inset-0 rounded-[50%/40%] opacity-40 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        
        {/* Subtle pattern */}
        <div 
          className="absolute inset-0 rounded-[50%/40%] opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)'
          }}
        />
        
        {/* JD Club Logo - Enhanced */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 text-emerald-400/30 font-bold text-sm sm:text-lg tracking-[0.3em] sm:tracking-[0.4em] uppercase select-none"
          style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }}
        >
          JD CLUB
        </motion.div>

        {/* Center area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 pt-6 sm:pt-8">
          {/* Hand counter - Enhanced */}
          <motion.div 
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-black/70 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] text-emerald-400 font-semibold border border-emerald-500/40 shadow-lg backdrop-blur-sm"
          >
            <span className="text-emerald-500/70">Hand</span> {handsPlayed}/{maxHands}
          </motion.div>

          {/* Current turn indicator - Enhanced */}
          <AnimatePresence mode="wait">
            {currentTurnPlayer && gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
              <motion.div
                key={currentTurnPlayer.userId}
                initial={{ scale: 0.8, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                className={cn(
                  'px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold shadow-xl border backdrop-blur-sm',
                  turnTimeLeft !== null && turnTimeLeft <= 10 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white border-red-400 animate-pulse shadow-red-500/40' 
                    : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-400/50 shadow-emerald-500/30'
                )}
              >
                🎯 {currentTurnPlayer.username}'s Turn
                {turnTimeLeft !== null && (
                  <span className={cn(
                    'ml-1.5 sm:ml-2 font-mono bg-black/30 px-1 sm:px-1.5 rounded',
                    turnTimeLeft <= 5 && 'text-yellow-300 animate-pulse'
                  )}>
                    {turnTimeLeft}s
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pot display - Premium design */}
          <motion.div 
            animate={{ scale: pot > 0 ? [1, 1.03, 1] : 1 }}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500 rounded-xl sm:rounded-2xl blur-sm opacity-40 animate-pulse" />
            <div className="relative bg-gradient-to-br from-slate-900/95 to-black/90 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl backdrop-blur-md border-2 border-yellow-500/50 shadow-2xl">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] sm:text-[9px] text-yellow-500/70 uppercase tracking-widest font-semibold">Total Pot</span>
                <span className="text-yellow-400 font-bold text-xl sm:text-2xl flex items-center gap-1.5 sm:gap-2 drop-shadow-lg">
                  <motion.span 
                    animate={{ rotate: pot > 0 ? [0, 10, -10, 0] : 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl sm:text-3xl"
                  >
                    💰
                  </motion.span>
                  <span className="font-mono">₱{pot.toLocaleString()}</span>
                </span>
              </div>
            </div>
          </motion.div>

          {/* Side pots display */}
          <SidePotDisplay sidePots={sidePots} />

          {/* Community Cards - Enhanced container with flip animations */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-1 sm:gap-1.5 flex-wrap justify-center max-w-[200px] sm:max-w-[240px] min-h-[50px] sm:min-h-[60px] bg-black/40 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-emerald-500/20 shadow-inner backdrop-blur-sm"
          >
            {[0, 1, 2, 3, 4].map((i) => {
              const isNewlyRevealed = i >= revealedCardCount && i < visibleCardCount;
              const isVisible = i < visibleCardCount && communityCards[i];
              
              // Calculate flip delay based on card position in the reveal
              // Flop: 0, 1, 2 (delays 0, 0.15, 0.3)
              // Turn: 3 (delay 0)
              // River: 4 (delay 0)
              let flipDelay = 0;
              if (revealedCardCount === 0 && i < 3) {
                flipDelay = i * 0.15; // Flop cards stagger
              }
              
              return (
                <div key={i} className="relative">
                  {isVisible ? (
                    <PlayingCard 
                      card={communityCards[i]} 
                      size="sm" 
                      animate={isNewlyRevealed}
                      flipDelay={flipDelay}
                    />
                  ) : (
                    <div className="w-8 h-11 sm:w-8 sm:h-11 rounded-md border border-dashed border-emerald-500/20 bg-black/20" />
                  )}
                </div>
              );
            })}
          </motion.div>

          {/* Game status indicator - Enhanced */}
          <AnimatePresence mode="wait">
            {gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
              <motion.div 
                key={gameStatus}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-gradient-to-r from-emerald-600/30 to-green-600/30 px-4 sm:px-5 py-1 sm:py-1.5 rounded-full text-emerald-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] border border-emerald-500/40 shadow-lg backdrop-blur-sm"
              >
                {gameStatus === 'preflop' ? 'Pre-Flop' : gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Chip Animations */}
      <AnimatePresence>
        {chipAnimations.map((anim) => (
          <ChipAnimation
            key={anim.id}
            fromPosition={anim.position}
            amount={anim.amount}
            id={anim.id}
            onComplete={() => removeChipAnimation(anim.id)}
          />
        ))}
      </AnimatePresence>

      {/* Pot Collection Animation */}
      <PotCollectionAnimation
        isCollecting={isCollectingPot}
        playerPositions={collectingPositions}
        onComplete={() => {
          setIsCollectingPot(false);
          setCollectingPositions([]);
        }}
      />


      {/* Player Bets on the Table - Enhanced and repositioned */}
      <AnimatePresence>
        {seats.map((player, displayPosition) => {
          if (!player || player.currentBet <= 0 || player.isFolded) return null;
          
          return (
            <motion.div
              key={`bet-${displayPosition}`}
              initial={{ scale: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn('absolute z-15', betPositions[displayPosition])}
            >
              <div className="flex items-center gap-1 bg-gradient-to-br from-amber-500 to-yellow-600 text-black px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/50 border border-yellow-300/60">
                <span className="text-xs">🪙</span>
                <span className="font-bold text-[10px] drop-shadow-sm">₱{player.currentBet.toLocaleString()}</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

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
          activeEmoji={player ? playerEmojis.get(player.userId) || null : null}
        />
      ))}
    </div>
  );
}
