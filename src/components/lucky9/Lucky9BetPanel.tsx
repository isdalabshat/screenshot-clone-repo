import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Coins, Plus, Minus } from 'lucide-react';

interface Lucky9BetPanelProps {
  minBet: number;
  maxBet: number;
  playerStack: number;
  onPlaceBet: (amount: number) => void;
  disabled: boolean;
}

export function Lucky9BetPanel({ minBet, maxBet, playerStack, onPlaceBet, disabled }: Lucky9BetPanelProps) {
  const [betAmount, setBetAmount] = useState(minBet);

  const chipValues = [10, 25, 50, 100, 500, 1000].filter(v => v <= playerStack && v <= maxBet);
  
  const adjustBet = (amount: number) => {
    const newBet = Math.max(minBet, Math.min(betAmount + amount, playerStack, maxBet));
    setBetAmount(newBet);
  };

  const handleBet = () => {
    if (betAmount >= minBet && betAmount <= maxBet && betAmount <= playerStack) {
      onPlaceBet(betAmount);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/98 to-slate-900/95 backdrop-blur-xl border-t border-yellow-500/30 p-4 z-30"
    >
      {/* Current bet display */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => adjustBet(-minBet)}
          disabled={betAmount <= minBet}
          className="h-10 w-10 rounded-full border-slate-600 bg-slate-800"
        >
          <Minus className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2 bg-black/50 px-6 py-3 rounded-xl border border-yellow-500/50 min-w-[140px] justify-center">
          <Coins className="h-5 w-5 text-yellow-400" />
          <span className="text-2xl font-bold text-yellow-400">₱{betAmount}</span>
        </div>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => adjustBet(minBet)}
          disabled={betAmount >= Math.min(playerStack, maxBet)}
          className="h-10 w-10 rounded-full border-slate-600 bg-slate-800"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick chip buttons - scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide justify-center">
        {chipValues.map((chip) => (
          <Button
            key={chip}
            variant="outline"
            size="sm"
            onClick={() => setBetAmount(chip)}
            className={`flex-shrink-0 h-12 px-4 rounded-full font-bold transition-all ${
              betAmount === chip 
                ? 'bg-yellow-500 text-black border-yellow-400 scale-110' 
                : 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20'
            }`}
          >
            ₱{chip}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBetAmount(Math.min(playerStack, maxBet))}
          className="flex-shrink-0 h-12 px-4 rounded-full border-red-500/50 text-red-400 hover:bg-red-500/20 font-bold"
        >
          ALL IN
        </Button>
      </div>

      {/* Confirm bet button */}
      <Button
        onClick={handleBet}
        disabled={disabled || betAmount < minBet || betAmount > playerStack}
        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl shadow-lg shadow-green-500/30"
      >
        <Coins className="h-5 w-5 mr-2" />
        Confirm Bet ₱{betAmount}
      </Button>

      <p className="text-center text-xs text-slate-500 mt-2">
        Min: ₱{minBet} | Max: ₱{maxBet} | Stack: ₱{playerStack}
      </p>
    </motion.div>
  );
}
