import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

interface Lucky9BetPanelProps {
  minBet: number;
  maxBet: number;
  playerStack: number;
  onPlaceBet: (amount: number) => void;
  disabled: boolean;
}

export function Lucky9BetPanel({ minBet, maxBet, playerStack, onPlaceBet, disabled }: Lucky9BetPanelProps) {
  const [betAmount, setBetAmount] = useState(minBet);

  const quickBets = [minBet, minBet * 2, minBet * 5, minBet * 10].filter(b => b <= maxBet && b <= playerStack);

  const handleBet = () => {
    if (betAmount >= minBet && betAmount <= maxBet && betAmount <= playerStack) {
      onPlaceBet(betAmount);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/90 backdrop-blur rounded-xl p-4 border border-slate-600"
    >
      <div className="text-center mb-3">
        <h3 className="text-lg font-bold text-white">Place Your Bet</h3>
        <p className="text-sm text-slate-400">Min: ₱{minBet} | Max: ₱{maxBet}</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-slate-300">Bet Amount</Label>
          <Input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Math.min(parseInt(e.target.value) || minBet, playerStack, maxBet))}
            min={minBet}
            max={Math.min(maxBet, playerStack)}
            className="bg-slate-900 border-slate-600 text-white"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {quickBets.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(amount)}
              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
            >
              ₱{amount}
            </Button>
          ))}
        </div>

        <Button
          onClick={handleBet}
          disabled={disabled || betAmount < minBet || betAmount > playerStack}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          Confirm Bet (₱{betAmount})
        </Button>
      </div>
    </motion.div>
  );
}
