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
  isCompact?: boolean; // For other players' cards to be smaller
  turnTimeLimit?: number; // Turn time limit in seconds (default 30)
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
          // Play tick sound for last 10 seconds
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
      // Reset when not current turn
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
  
  // Show banker bet controls during betting phase if player has bet pending
  const showBetControls = isBankerView && gameStatus === 'betting' && player.currentBet > 0 && player.betAccepted === null;

  // Determine seat styling based on state
  const getSeatBorder = () => {
    if (isWinner) return 'border-yellow-400 shadow-lg shadow-yellow-500/40';
    if (isCurrentTurn) return 'border-green-400 shadow-lg shadow-green-500/40';
    if (isMe) return 'border-blue-400/60';
    if (player.betAccepted === true) return 'border-green-500/50';
    if (player.betAccepted === false) return 'border-red-500/50';
    return 'border-amber-700/60';
  };

  return (
    <motion.div 
      className={`relative transition-all`}
      data-player-seat={player.id}
      data-player-user-id={player.userId}
      animate={isCurrentTurn ? { scale: [1, 1.03, 1] } : {}}
      transition={{ repeat: isCurrentTurn ? Infinity : 0, duration: 1.5 }}
    >

      {/* Visual Seat Frame */}
      <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-b from-amber-900/40 via-amber-800/20 to-amber-900/40 blur-[1px]" />
      <div className="absolute -inset-1 rounded-xl border-2 border-amber-700/40 bg-gradient-to-b from-amber-950/60 to-slate-950/60" />
      
      {/* Seat cushion effect - Compact layout for all players */}
      <div className={cn(
        "relative bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 backdrop-blur rounded-lg border-2",
        isMe 
          ? "p-1 w-[70px] h-auto" // Smaller square for current user
          : isCompact 
            ? "p-0.5 min-w-[50px] max-w-[55px]" 
            : "p-0.5 min-w-[55px] max-w-[65px]",
        getSeatBorder()
      )}>
        {/* Player Avatar, info, and cards - all inside the panel */}
        <div className="flex items-center gap-0.5">
          {/* Avatar on the left */}
          <Lucky9PlayerAvatar
            username={player.username}
            isMe={isMe}
            size="xs"
            currentEmoji={currentEmoji}
          />
          
          {/* Info in the middle */}
          <div className="min-w-0 overflow-hidden flex-1">
            <div className="flex items-center gap-0.5">
              {isMe && <Badge className="bg-blue-500 px-0.5 py-0 flex-shrink-0 text-[5px]">YOU</Badge>}
              <span className={cn(
                "font-medium text-white truncate block",
                isMe ? "text-[6px] max-w-[25px]" : isCompact ? "text-[5px] max-w-[18px]" : "text-[6px] max-w-[22px]"
              )}>{player.username}</span>
            </div>
            <span className={cn(
              "text-yellow-400 font-mono block font-bold",
              isMe ? "text-[6px]" : isCompact ? "text-[5px]" : "text-[5px]"
            )}>₱{player.stack}</span>
          </div>

          {/* Cards on the right side - inside the panel */}
          {cards.length > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {cards.map((card, i) => (
                <Lucky9RevealableCard 
                  key={i} 
                  card={card} 
                  hidden={!showCards}
                  canReveal={canRevealCards}
                  delay={i * 0.1} 
                  small
                  extraSmall
                  onReveal={() => onCardReveal?.(i)}
                />
              ))}
              {/* Hand value */}
              {showCards && handValue !== null && (
                <div className="flex flex-col items-center ml-0.5">
                  {(isNatural || showNaturalBadge) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black flex items-center gap-0.5 text-[5px] px-0.5">
                        <Sparkles className="h-1.5 w-1.5" />
                        9!
                      </Badge>
                    </motion.div>
                  )}
                  <div className={cn(
                    "font-bold text-[8px] bg-slate-900/80 rounded px-0.5",
                    handValue === 9 ? 'text-amber-400' : 'text-white'
                  )}>
                    {handValue}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Win indicator */}
        <AnimatePresence>
          {isWinner && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 z-30"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[8px] font-bold shadow-lg whitespace-nowrap',
                  player.isNatural
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black'
                    : 'bg-gradient-to-r from-green-500 to-emerald-400 text-white'
                )}
              >
                {player.isNatural ? '🏆9!' : '🎉WIN'}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Decision indicator (Hirit/Good) */}
        <AnimatePresence>
          {showDecision && currentDecision && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -10 }}
              className="absolute -top-6 left-1/2 -translate-x-1/2 z-40"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: 2, duration: 0.3 }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap shadow-lg',
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

        {/* Bet display */}
        {player.currentBet > 0 && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-r from-green-900/80 to-emerald-900/80 rounded px-1.5 py-0.5 mb-1 border border-green-500/30"
          >
            <div className="flex items-center justify-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-green-400 to-green-600 border border-green-300 shadow-sm flex items-center justify-center">
                <span className="text-[5px] font-bold text-white">₱</span>
              </div>
              <span className="text-green-300 font-bold text-[10px]">₱{player.currentBet}</span>
              {player.betAccepted === true && <Check className="h-3 w-3 text-green-400" />}
              {player.betAccepted === false && <X className="h-3 w-3 text-red-400" />}
              {player.betAccepted === null && <Clock className="h-3 w-3 text-yellow-400 animate-pulse" />}
            </div>
          </motion.div>
        )}

        {/* Banker bet acceptance controls */}
        {showBetControls && onAcceptBet && onRejectBet && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-1 mb-1"
          >
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
          </motion.div>
        )}

        {/* Admin kick player button */}
        {isAdmin && !isMe && onKickPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-1"
          >
            <Button
              size="sm"
              onClick={() => onKickPlayer(player.id)}
              disabled={isProcessing}
              className="w-full h-5 px-1 bg-red-700 hover:bg-red-600 text-white text-[7px] gap-0.5"
            >
              <UserX className="h-2.5 w-2.5" />
              Kick
            </Button>
          </motion.div>
        )}

        {/* Bet status indicator for non-banker view */}
        {!isBankerView && player.currentBet > 0 && gameStatus === 'betting' && (
          <div className="text-center mb-0.5">
            {player.betAccepted === null && (
              <Badge className="bg-yellow-600 text-[6px] px-1">Pending</Badge>
            )}
            {player.betAccepted === true && (
              <Badge className="bg-green-600 text-[6px] px-1">✓ OK</Badge>
            )}
            {player.betAccepted === false && (
              <Badge className="bg-red-600 text-[6px] px-1">✗ No</Badge>
            )}
          </div>
        )}

        {/* Cards are now displayed in the header row next to avatar */}

        {/* Turn indicator with countdown timer */}
        {isCurrentTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-0.5"
          >
            {/* Timer bar */}
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden mb-0.5">
              <motion.div 
                className={cn(
                  "h-full transition-colors",
                  turnTimeLeft <= 10 ? 'bg-red-500' : 'bg-green-500'
                )}
                style={{ width: `${(turnTimeLeft / turnTimeLimit) * 100}%` }}
              />
            </div>
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="flex items-center justify-center gap-1"
            >
              <Timer className={cn(
                "h-2.5 w-2.5",
                turnTimeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-green-400'
              )} />
              <span className={cn(
                "text-[8px] font-bold tabular-nums",
                turnTimeLeft <= 10 ? 'text-red-400' : 'text-green-400'
              )}>
                {turnTimeLeft}s
              </span>
            </motion.div>
          </motion.div>
        )}

        {/* Result */}
        {player.result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mt-0.5"
          >
            <Badge className={`text-[7px] ${
              player.result === 'win' || player.result === 'natural_win' ? 'bg-green-500' : 
              player.result === 'lose' ? 'bg-red-500' : 'bg-slate-500'
            }`}>
              {player.result === 'win' || player.result === 'natural_win' ? '✓ Won' : player.result === 'lose' ? '✗ Lost' : '↔'}
            </Badge>
            {player.winnings !== 0 && (
              <div className={`text-[10px] font-bold ${player.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {player.winnings > 0 ? '+' : ''}₱{player.winnings}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
