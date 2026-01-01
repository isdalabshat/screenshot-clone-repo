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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-yellow-500/30 px-2 py-1.5 z-30 safe-area-bottom"
    >
      {/* Single row: controls + bet amount + confirm */}
      <div className="flex items-center gap-1.5 max-w-sm mx-auto">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => adjustBet(-minBet)}
          disabled={betAmount <= minBet}
          className="h-7 w-7 rounded-full border-slate-600 bg-slate-800 flex-shrink-0"
        >
          <Minus className="h-3 w-3" />
        </Button>
        
        <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded border border-yellow-500/50 flex-shrink-0">
          <Coins className="h-3 w-3 text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400">₱{betAmount}</span>
        </div>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => adjustBet(minBet)}
          disabled={betAmount >= Math.min(playerStack, maxBet)}
          className="h-7 w-7 rounded-full border-slate-600 bg-slate-800 flex-shrink-0"
        >
          <Plus className="h-3 w-3" />
        </Button>

        <Button
          onClick={handleBet}
          disabled={disabled || betAmount < minBet || betAmount > playerStack}
          className="flex-1 h-8 text-xs font-bold bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-lg"
        >
          Confirm ₱{betAmount}
        </Button>
      </div>

      {/* Compact chip row */}
      <div className="flex gap-1 overflow-x-auto py-1 scrollbar-hide justify-center max-w-sm mx-auto">
        {chipValues.slice(0, 4).map((chip) => (
          <Button
            key={chip}
            variant="outline"
            size="sm"
            onClick={() => setBetAmount(chip)}
            className={`h-6 px-2 rounded-full text-[10px] font-bold ${
              betAmount === chip 
                ? 'bg-yellow-500 text-black border-yellow-400' 
                : 'border-yellow-500/50 text-yellow-400'
            }`}
          >
            ₱{chip}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBetAmount(Math.min(playerStack, maxBet))}
          className="h-6 px-2 rounded-full border-red-500/50 text-red-400 text-[10px] font-bold"
        >
          MAX
        </Button>
      </div>
    </motion.div>
  );
}
