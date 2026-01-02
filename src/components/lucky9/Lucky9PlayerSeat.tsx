import { useState, useEffect, useRef } from 'react';
import { Lucky9Player } from '@/types/lucky9';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9PlayerAvatar } from './Lucky9PlayerAvatar';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Sparkles, Timer, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLucky9Sounds } from '@/hooks/useLucky9Sounds';

interface Lucky9PlayerSeatProps {
  player: Lucky9Player;
  isCurrentTurn: boolean;
  showCards: boolean;
  gameStatus: string;
  isMe?: boolean;
  isBankerView?: boolean;
  isAdmin?: boolean;
  onAcceptBet?: (playerId: string) => void;
  onRejectBet?: (playerId: string) => void;
  onKickPlayer?: (playerId: string) => void;
  isProcessing?: boolean;
  canRevealCards?: boolean;
  onCardReveal?: (cardIndex: number) => void;
  currentEmoji?: string | null;
  currentDecision?: 'hirit' | 'good' | null;
  showNaturalBadge?: boolean;
  isWinner?: boolean;
  isCompact?: boolean;
  turnTimeLimit?: number;
}

export function Lucky9PlayerSeat({ 
  player, 
  isCurrentTurn, 
  showCards, 
  gameStatus, 
  isMe,
  isBankerView,
  isAdmin,
  onAcceptBet,
  onRejectBet,
  onKickPlayer,
  isProcessing,
  canRevealCards,
  onCardReveal,
  currentEmoji,
  currentDecision,
  showNaturalBadge,
  isWinner,
  isCompact = false,
  turnTimeLimit = 30
}: Lucky9PlayerSeatProps) {
  const { playSound } = useLucky9Sounds();
  const [showDecision, setShowDecision] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnTimeLimit);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickSecond = useRef<number | null>(null);

  useEffect(() => {
    if (currentDecision) {
      setShowDecision(true);
      const timer = setTimeout(() => setShowDecision(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentDecision]);

  // Turn countdown timer
  useEffect(() => {
    if (isCurrentTurn) {
      setTurnTimeLeft(turnTimeLimit);
      lastTickSecond.current = null;
      
      turnTimerRef.current = setInterval(() => {
        setTurnTimeLeft(prev => {
          const newTime = Math.max(0, prev - 1);
          if (newTime <= 10 && newTime > 0 && lastTickSecond.current !== newTime) {
            playSound('clockTick');
          }
          lastTickSecond.current = newTime;
          return newTime;
        });
      }, 1000);
      
      return () => {
        if (turnTimerRef.current) {
          clearInterval(turnTimerRef.current);
        }
      };
    } else {
      setTurnTimeLeft(turnTimeLimit);
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    }
  }, [isCurrentTurn, turnTimeLimit, playSound]);
  
  const cards = player.cards || [];
  const handValue = cards.length > 0 ? calculateLucky9Value(cards) : null;
  const isNatural = cards.length === 2 && isNatural9(cards);
  
  const showBetControls = isBankerView && gameStatus === 'betting' && player.currentBet > 0 && player.betAccepted === null;

  const getSeatBorder = () => {
    if (isWinner) return 'border-yellow-400 shadow-lg shadow-yellow-500/40';
    if (isCurrentTurn) return 'border-green-400 shadow-lg shadow-green-500/40';
    if (isMe) return 'border-blue-400/60';
    if (player.betAccepted === true) return 'border-green-500/50';
    if (player.betAccepted === false) return 'border-red-500/50';
    return 'border-slate-600/60';
  };

  // Format winnings for display (e.g., 5700 -> "+5.7K")
  const formatWinnings = (amount: number) => {
    if (Math.abs(amount) >= 1000) {
      return `${amount > 0 ? '+' : ''}${(amount / 1000).toFixed(1)}K`;
    }
    return `${amount > 0 ? '+' : ''}${amount}`;
  };

  // Check if result should be shown (after game is finished)
  const showResult = player.result && (gameStatus === 'revealing' || gameStatus === 'finished' || gameStatus === 'showdown');
  const isPlayerWinner = player.result === 'win' || player.result === 'natural_win';
  const isPlayerLoser = player.result === 'lose';

  return (
    <motion.div 
      className="relative"
      data-player-seat={player.id}
      data-player-user-id={player.userId}
      animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : {}}
      transition={{ repeat: isCurrentTurn ? Infinity : 0, duration: 1.5 }}
    >
      {/* Decision indicator (Hirit/Good) - positioned above entire component to avoid overlap */}
      <AnimatePresence>
        {showDecision && currentDecision && !player.result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 5 }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 z-50"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: 2, duration: 0.3 }}
              className={cn(
                'px-2 py-0.5 rounded-full text-[8px] font-bold uppercase whitespace-nowrap shadow-lg',
                currentDecision === 'hirit' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white' 
                  : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black'
              )}
            >
              {currentDecision === 'hirit' ? '🎴 Hirit!' : '✋ Good!'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result indicator - WIN/LOSE badge positioned above component */}
      <AnimatePresence>
        {showResult && (isPlayerWinner || isPlayerLoser) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 z-50"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className={cn(
                'px-2 py-0.5 rounded-full text-[8px] font-black uppercase whitespace-nowrap shadow-lg',
                isPlayerWinner 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white shadow-green-500/50' 
                  : 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/50'
              )}
            >
              {isPlayerWinner ? '🏆 WIN!' : '❌ LOSE'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main seat panel - compact like reference */}
      <div className={cn(
        "relative bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-slate-800/90 backdrop-blur rounded-xl border-2 overflow-visible",
        isMe ? "p-1" : "p-0.5",
        getSeatBorder(),
        isPlayerWinner && "ring-2 ring-green-400 ring-opacity-50",
        isPlayerLoser && "opacity-80"
      )}>
        {/* Layout: Avatar left, Cards overlapping right */}
        <div className="relative flex items-center">
          {/* Avatar - prominent on left */}
          <div className="relative z-10 flex-shrink-0">
            <Lucky9PlayerAvatar
              username={player.username}
              isMe={isMe}
              size={isMe ? "sm" : "xs"}
              currentEmoji={currentEmoji}
            />
          </div>
          
          {/* Cards positioned further right - no overlap with avatar */}
          {cards.length > 0 && (
            <div className={cn(
              "absolute top-1/2 -translate-y-1/2 flex items-center z-20",
              isMe ? "left-9" : "left-7"
            )}>
              <div className="flex -space-x-0.5">
                {cards.map((card, i) => (
                  <Lucky9RevealableCard 
                    key={i} 
                    card={card} 
                    hidden={!showCards}
                    canReveal={canRevealCards}
                    delay={i * 0.1} 
                    small={isMe}
                    extraSmall={!isMe}
                    onReveal={() => onCardReveal?.(i)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Score badge below cards - like "LUCKY 9" or "7 POINTS" in reference */}
        {showCards && handValue !== null && cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-0.5 flex justify-center"
          >
            <div className={cn(
              "px-1.5 py-0.5 rounded text-[7px] font-bold flex items-center gap-0.5",
              (isNatural || showNaturalBadge)
                ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/50 animate-pulse" 
                : handValue === 9 
                  ? "bg-gradient-to-r from-amber-600 to-yellow-500 text-white" 
                  : "bg-gradient-to-r from-slate-700 to-slate-600 text-white"
            )}>
              {(isNatural || showNaturalBadge) && (
                <Sparkles className="h-2.5 w-2.5 text-yellow-700" />
              )}
              {(isNatural || showNaturalBadge) ? 'LUCKY 9!' : handValue === 9 ? 'LUCKY 9' : `${handValue} POINTS`}
            </div>
          </motion.div>
        )}

        {/* Bet status indicator (simplified - actual bet shown on table) */}
        {player.currentBet > 0 && gameStatus === 'betting' && (
          <div className="mt-0.5 flex items-center justify-center gap-0.5">
            {player.betAccepted === true && (
              <div className="flex items-center gap-0.5 text-green-400">
                <Check className="h-2 w-2" />
                <span className="text-[7px] font-medium">Accepted</span>
              </div>
            )}
            {player.betAccepted === false && (
              <div className="flex items-center gap-0.5 text-red-400">
                <X className="h-2 w-2" />
                <span className="text-[7px] font-medium">Rejected</span>
              </div>
            )}
            {player.betAccepted === null && (
              <div className="flex items-center gap-0.5 text-yellow-400">
                <Clock className="h-2 w-2 animate-pulse" />
                <span className="text-[7px] font-medium">Pending</span>
              </div>
            )}
          </div>
        )}

        {/* Banker bet controls with bet amount display */}
        {showBetControls && onAcceptBet && onRejectBet && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-0.5 mt-0.5"
          >
            {/* Bet amount display for banker - prominent like reference image */}
            <div className="bg-amber-900/90 px-2 py-0.5 rounded text-center border border-amber-500/50">
              <span className="text-amber-300 font-bold text-[10px]">₱{player.currentBet.toLocaleString()}</span>
            </div>
            <div className="flex gap-0.5">
              <Button
                size="sm"
                onClick={() => onAcceptBet(player.id)}
                disabled={isProcessing}
                className="flex-1 h-5 px-1 bg-green-600 hover:bg-green-500 text-white text-[8px]"
              >
                <Check className="h-2.5 w-2.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => onRejectBet(player.id)}
                disabled={isProcessing}
                className="flex-1 h-5 px-1 bg-red-600 hover:bg-red-500 text-white text-[8px]"
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Admin kick button */}
        {isAdmin && !isMe && onKickPlayer && (
          <Button
            size="sm"
            onClick={() => onKickPlayer(player.id)}
            disabled={isProcessing}
            className="w-full h-4 mt-0.5 bg-red-700 hover:bg-red-600 text-white text-[6px] gap-0.5"
          >
            <UserX className="h-2 w-2" />
            Kick
          </Button>
        )}

        {/* Turn timer */}
        {isCurrentTurn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-0.5">
            <div className="h-0.5 bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className={cn("h-full", turnTimeLeft <= 10 ? 'bg-red-500' : 'bg-green-500')}
                style={{ width: `${(turnTimeLeft / turnTimeLimit) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <Timer className={cn("h-2 w-2", turnTimeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-green-400')} />
              <span className={cn("text-[7px] font-bold", turnTimeLeft <= 10 ? 'text-red-400' : 'text-green-400')}>
                {turnTimeLeft}s
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Balance and name below the panel - like reference */}
      <div className="text-center mt-0.5">
        <div className="text-yellow-400 font-bold text-[9px] drop-shadow">
          ₱{player.stack.toLocaleString()}
        </div>
        <div className="flex items-center justify-center gap-0.5">
          {isMe && (
            <Badge className="bg-blue-500 px-0.5 py-0 text-[5px]">YOU</Badge>
          )}
          <span className="text-white/80 text-[7px] font-medium truncate max-w-[50px]">
            {player.username}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
