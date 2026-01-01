import { useState, useEffect } from 'react';
import { Lucky9Player } from '@/types/lucky9';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9PlayerAvatar } from './Lucky9PlayerAvatar';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Lucky9PlayerSeatProps {
  player: Lucky9Player;
  isCurrentTurn: boolean;
  showCards: boolean;
  gameStatus: string;
  isMe?: boolean;
  isBankerView?: boolean;
  onAcceptBet?: (playerId: string) => void;
  onRejectBet?: (playerId: string) => void;
  isProcessing?: boolean;
  canRevealCards?: boolean;
  onCardReveal?: (cardIndex: number) => void;
  currentEmoji?: string | null;
  currentDecision?: 'hirit' | 'good' | null;
  showNaturalBadge?: boolean;
  isWinner?: boolean;
}

export function Lucky9PlayerSeat({ 
  player, 
  isCurrentTurn, 
  showCards, 
  gameStatus, 
  isMe,
  isBankerView,
  onAcceptBet,
  onRejectBet,
  isProcessing,
  canRevealCards,
  onCardReveal,
  currentEmoji,
  currentDecision,
  showNaturalBadge,
  isWinner
}: Lucky9PlayerSeatProps) {
  const [showDecision, setShowDecision] = useState(false);

  useEffect(() => {
    if (currentDecision) {
      setShowDecision(true);
      const timer = setTimeout(() => setShowDecision(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentDecision]);
  
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
      
      {/* Seat cushion effect */}
      <div className={cn(
        "relative bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 backdrop-blur rounded-lg p-1.5 border-2 min-w-[95px]",
        getSeatBorder()
      )}>
        {/* Player Avatar and info */}
        <div className="flex items-center gap-1 mb-1">
          <Lucky9PlayerAvatar
            username={player.username}
            isMe={isMe}
            size="sm"
            currentEmoji={currentEmoji}
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] font-medium text-white truncate block max-w-[40px]">{player.username}</span>
              {isMe && <Badge className="bg-blue-500 text-[6px] px-0.5 py-0 flex-shrink-0">YOU</Badge>}
            </div>
            <span className="text-yellow-400 font-mono text-[8px] block">₱{player.stack}</span>
          </div>
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

        {/* Cards */}
        {cards.length > 0 && (
          <div className="flex gap-0.5 justify-center mb-0.5">
            {cards.map((card, i) => (
              <Lucky9RevealableCard 
                key={i} 
                card={card} 
                hidden={!showCards}
                canReveal={canRevealCards}
                delay={i * 0.1} 
                small
                onReveal={() => onCardReveal?.(i)}
              />
            ))}
          </div>
        )}

        {/* Hand value - only show if cards visible */}
        {showCards && handValue !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            {(isNatural || showNaturalBadge) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[6px] px-1 mb-0.5 flex items-center gap-0.5">
                  <Sparkles className="h-2 w-2" />
                  9!
                </Badge>
              </motion.div>
            )}
            <div className={`text-base font-bold ${handValue === 9 ? 'text-amber-400' : 'text-white'}`}>
              {handValue}
            </div>
          </motion.div>
        )}

        {/* Turn indicator */}
        {isCurrentTurn && (
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <Badge className="bg-green-500 text-black w-full justify-center text-[8px] font-bold py-0 mt-0.5">
              {isMe ? '🎯 Turn!' : '⏳...'}
            </Badge>
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
