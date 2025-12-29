import { Lucky9Player } from '@/types/lucky9';
import { Lucky9Card } from './Lucky9Card';
import { calculateLucky9Value } from '@/lib/lucky9/deck';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface Lucky9PlayerSeatProps {
  player: Lucky9Player;
  isCurrentTurn: boolean;
  showCards: boolean;
  gameStatus: string;
}

export function Lucky9PlayerSeat({ player, isCurrentTurn, showCards, gameStatus }: Lucky9PlayerSeatProps) {
  const handValue = player.cards.length > 0 ? calculateLucky9Value(player.cards) : null;
  
  const getResultBadge = () => {
    if (!player.result) return null;
    
    const variants: Record<string, { bg: string; text: string }> = {
      'natural_win': { bg: 'bg-amber-500', text: '🎉 Natural 9 Win!' },
      'win': { bg: 'bg-green-500', text: '✓ Win' },
      'lose': { bg: 'bg-red-500', text: '✗ Lose' },
      'push': { bg: 'bg-slate-500', text: '↔ Push' }
    };
    
    const v = variants[player.result];
    return v ? <Badge className={v.bg}>{v.text}</Badge> : null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative p-3 rounded-xl border-2 transition-all duration-300 ${
        isCurrentTurn 
          ? 'border-yellow-400 bg-yellow-500/20 shadow-lg shadow-yellow-500/30' 
          : 'border-slate-600/50 bg-slate-800/50'
      }`}
    >
      {/* Player Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white truncate max-w-[100px]">
            {player.username}
          </span>
          {player.isNatural && (
            <Badge className="bg-amber-500 text-xs">Natural 9!</Badge>
          )}
        </div>
        <div className="text-yellow-400 font-mono text-sm">
          ₱{player.stack.toLocaleString()}
        </div>
      </div>

      {/* Bet Display */}
      {player.currentBet > 0 && (
        <div className="text-center mb-2">
          <span className="text-xs text-slate-400">Bet:</span>
          <span className="ml-1 text-green-400 font-bold">₱{player.currentBet}</span>
        </div>
      )}

      {/* Cards */}
      <div className="flex gap-1 justify-center min-h-[60px]">
        {player.cards.map((card, i) => (
          <Lucky9Card key={i} card={card} delay={i * 0.1} small />
        ))}
      </div>

      {/* Hand Value */}
      {showCards && handValue !== null && player.cards.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-center"
        >
          <span className={`text-lg font-bold ${handValue === 9 ? 'text-amber-400' : 'text-white'}`}>
            Value: {handValue}
          </span>
        </motion.div>
      )}

      {/* Result */}
      {player.result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 text-center space-y-1"
        >
          {getResultBadge()}
          {player.winnings > 0 && (
            <div className="text-green-400 font-bold">
              +₱{player.winnings.toLocaleString()}
            </div>
          )}
        </motion.div>
      )}

      {/* Turn Indicator */}
      {isCurrentTurn && gameStatus === 'player_turns' && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute -top-2 left-1/2 -translate-x-1/2"
        >
          <Badge className="bg-yellow-500 text-black">Your Turn!</Badge>
        </motion.div>
      )}
    </motion.div>
  );
}
