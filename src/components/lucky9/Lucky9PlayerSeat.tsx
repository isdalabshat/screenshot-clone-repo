import { Lucky9Player } from '@/types/lucky9';
import { Lucky9Card } from './Lucky9Card';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';

interface Lucky9PlayerSeatProps {
  player: Lucky9Player;
  isCurrentTurn: boolean;
  showCards: boolean;
  gameStatus: string;
  isMe?: boolean;
}

export function Lucky9PlayerSeat({ player, isCurrentTurn, showCards, gameStatus, isMe }: Lucky9PlayerSeatProps) {
  const cards = player.cards || [];
  const handValue = cards.length > 0 ? calculateLucky9Value(cards) : null;
  const isNatural = cards.length === 2 && isNatural9(cards);

  return (
    <motion.div 
      className={`relative bg-slate-900/95 backdrop-blur rounded-xl p-2 min-w-[100px] border-2 transition-all ${
        isCurrentTurn 
          ? 'border-green-400 shadow-lg shadow-green-500/40' 
          : isMe 
            ? 'border-blue-500/70' 
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
          <span className="text-green-400 font-mono">Bet: ₱{player.currentBet}</span>
        )}
      </div>

      {/* Cards */}
      {cards.length > 0 && (
        <div className="flex gap-1 justify-center mb-1">
          {cards.map((card, i) => (
            <Lucky9Card 
              key={i} 
              card={showCards ? card : ''} 
              hidden={!showCards}
              delay={i * 0.1} 
              small 
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
