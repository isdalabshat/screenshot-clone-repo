import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ActionType } from '@/types/poker';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ActionButtonsProps {
  currentBet: number;
  playerBet: number;
  playerStack: number;
  bigBlind: number;
  canCheck: boolean;
  isCurrentPlayer: boolean;
  isActionPending?: boolean;
  onAction: (action: ActionType, amount?: number) => void;
}

export default function ActionButtons({
  currentBet,
  playerBet,
  playerStack,
  bigBlind,
  canCheck,
  isCurrentPlayer,
  isActionPending = false,
  onAction
}: ActionButtonsProps) {
  const callAmount = Math.min(currentBet - playerBet, playerStack);
  const minRaise = Math.max(currentBet + bigBlind, bigBlind * 2);
  const maxBet = playerStack + playerBet;
  
  const [betAmount, setBetAmount] = useState(minRaise);

  useEffect(() => {
    setBetAmount(Math.min(minRaise, maxBet));
  }, [minRaise, maxBet, currentBet]);

  if (!isCurrentPlayer) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-muted-foreground text-xs text-center py-2"
      >
        Waiting for your turn...
      </motion.div>
    );
  }

  const canRaise = playerStack > callAmount && maxBet > minRaise;
  const isDisabled = isActionPending;

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex flex-col gap-3 w-full"
    >
      {/* Main action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onAction('fold')}
          disabled={isDisabled}
          className="font-bold text-xs h-10 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isDisabled ? <Loader2 className="w-4 h-4 animate-spin" /> : 'FOLD'}
        </Button>
        
        {canCheck ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction('check')}
            disabled={isDisabled}
            className="font-bold text-xs h-10 bg-blue-600 hover:bg-blue-700 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isDisabled ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CHECK'}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction('call')}
            disabled={callAmount > playerStack || isDisabled}
            className="font-bold text-xs h-10 bg-blue-600 hover:bg-blue-700 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isDisabled ? <Loader2 className="w-4 h-4 animate-spin" /> : `CALL ${callAmount}`}
          </Button>
        )}
        
        <Button
          variant="default"
          size="sm"
          onClick={() => onAction('all_in')}
          disabled={isDisabled}
          className="font-bold text-xs h-10 bg-red-600 hover:bg-red-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {isDisabled ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ALL IN'}
        </Button>
      </div>

      {/* Raise section */}
      {canRaise && (
        <div className="bg-card/80 backdrop-blur-sm rounded-xl p-3 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Raise to:</span>
            <span className="text-sm font-bold text-primary">{betAmount}</span>
          </div>
          <Slider
            value={[betAmount]}
            onValueChange={([value]) => setBetAmount(value)}
            min={Math.min(minRaise, maxBet)}
            max={maxBet}
            step={bigBlind}
            className="mb-3"
            disabled={isDisabled}
          />
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(Math.min(minRaise, maxBet))}
              disabled={isDisabled}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              Min
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(Math.min(Math.floor(maxBet * 0.33), maxBet))}
              disabled={isDisabled}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              1/3 Pot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(Math.min(Math.floor(maxBet * 0.5), maxBet))}
              disabled={isDisabled}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              1/2 Pot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(maxBet)}
              disabled={isDisabled}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              Max
            </Button>
          </div>
          <Button
            className="w-full font-bold text-sm h-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            onClick={() => onAction(currentBet === 0 ? 'bet' : 'raise', betAmount)}
            disabled={betAmount > maxBet || isDisabled}
          >
            {isDisabled ? <Loader2 className="w-4 h-4 animate-spin" /> : `${currentBet === 0 ? 'BET' : 'RAISE TO'} ${betAmount}`}
          </Button>
        </div>
      )}
    </motion.div>
  );
}