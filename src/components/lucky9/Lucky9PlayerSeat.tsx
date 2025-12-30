import { Lucky9Player } from '@/types/lucky9';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9ChipStack } from './Lucky9BetAnimation';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { User, Check, X, Clock } from 'lucide-react';

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
  onCardReveal
}: Lucky9PlayerSeatProps) {
  const cards = player.cards || [];
  const handValue = cards.length > 0 ? calculateLucky9Value(cards) : null;
  const isNatural = cards.length === 2 && isNatural9(cards);
  
  // Show banker bet controls during betting phase if player has bet pending
  const showBetControls = isBankerView && gameStatus === 'betting' && player.currentBet > 0 && player.betAccepted === null;

  return (
    <motion.div 
      className={`relative bg-slate-900/95 backdrop-blur rounded-xl p-2 min-w-[110px] border-2 transition-all ${
        isCurrentTurn 
          ? 'border-green-400 shadow-lg shadow-green-500/40' 
          : isMe 
            ? 'border-blue-500/70' 
            : player.betAccepted === true 
              ? 'border-green-500/50'
              : player.betAccepted === false
                ? 'border-red-500/50'
                : 'border-slate-700'
      }`}
      animate={isCurrentTurn ? { scale: [1, 1.02, 1] } : {}}
      transition={{ repeat: isCurrentTurn ? Infinity : 0, duration: 1.5 }}
    >
      {/* Player info */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-medium text-white truncate">{player.username}</span>
        </div>
        {isMe && <Badge className="bg-blue-500 text-[9px] px-1">YOU</Badge>}
      </div>

      {/* Stack and bet */}
      <div className="flex items-center justify-between text-[10px] mb-1.5">
        <span className="text-yellow-400 font-mono">₱{player.stack}</span>
        {player.currentBet > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-green-400 font-mono">₱{player.currentBet}</span>
            {player.betAccepted === true && <Check className="h-3 w-3 text-green-400" />}
            {player.betAccepted === false && <X className="h-3 w-3 text-red-400" />}
            {player.betAccepted === null && <Clock className="h-3 w-3 text-yellow-400 animate-pulse" />}
          </div>
        )}
      </div>

      {/* Banker bet acceptance controls */}
      {showBetControls && onAcceptBet && onRejectBet && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex gap-1 mb-1.5"
        >
          <Button
            size="sm"
            onClick={() => onAcceptBet(player.id)}
            disabled={isProcessing}
            className="flex-1 h-7 px-2 bg-green-600 hover:bg-green-500 text-white text-[10px]"
          >
            <Check className="h-3 w-3 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            onClick={() => onRejectBet(player.id)}
            disabled={isProcessing}
            className="flex-1 h-7 px-2 bg-red-600 hover:bg-red-500 text-white text-[10px]"
          >
            <X className="h-3 w-3 mr-1" />
            Reject
          </Button>
        </motion.div>
      )}

      {/* Bet status indicator for non-banker view */}
      {!isBankerView && player.currentBet > 0 && gameStatus === 'betting' && (
        <div className="text-center mb-1">
          {player.betAccepted === null && (
            <Badge className="bg-yellow-600 text-[8px]">Pending</Badge>
          )}
          {player.betAccepted === true && (
            <Badge className="bg-green-600 text-[8px]">Accepted</Badge>
          )}
          {player.betAccepted === false && (
            <Badge className="bg-red-600 text-[8px]">Rejected</Badge>
          )}
        </div>
      )}

      {/* Cards */}
      {cards.length > 0 && (
        <div className="flex gap-1 justify-center mb-1">
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

      {/* Bet chip stack */}
      {player.currentBet > 0 && gameStatus !== 'betting' && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <Lucky9ChipStack amount={player.currentBet} small />
        </div>
      )}

      {/* Hand value - only show if cards visible */}
      {showCards && handValue !== null && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          {isNatural && (
            <Badge className="bg-amber-500 text-black text-[9px] px-1 mb-0.5">Natural!</Badge>
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
          <Badge className="bg-green-500 text-black w-full justify-center text-[9px] mt-1">
            {isMe ? 'Your Turn!' : 'Playing...'}
          </Badge>
        </motion.div>
      )}

      {/* Result */}
      {player.result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mt-1"
        >
          <Badge className={`text-[9px] ${
            player.result === 'win' || player.result === 'natural_win' ? 'bg-green-500' : 
            player.result === 'lose' ? 'bg-red-500' : 'bg-slate-500'
          }`}>
            {player.result === 'win' || player.result === 'natural_win' ? '✓ Won' : player.result === 'lose' ? '✗ Lost' : '↔ Push'}
          </Badge>
          {player.winnings !== 0 && (
            <div className={`text-xs font-bold ${player.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {player.winnings > 0 ? '+' : ''}₱{player.winnings}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
