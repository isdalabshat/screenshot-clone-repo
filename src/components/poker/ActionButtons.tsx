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

  // Don't show action buttons if not current player's turn OR action is pending
  if (!isCurrentPlayer || isActionPending) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-muted-foreground text-xs text-center py-2 px-4 bg-card/50 rounded-lg"
      >
        <span className="flex items-center justify-center gap-2">
          {isActionPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <span className="animate-pulse">⏳</span>
              Waiting for your turn...
            </>
          )}
        </span>
      </motion.div>
    );
  }

  const canRaise = playerStack > callAmount && maxBet > minRaise;

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
          className="font-bold text-xs h-10 transition-all hover:scale-105 active:scale-95"
        >
          FOLD
        </Button>
        
        {canCheck ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction('check')}
            className="font-bold text-xs h-10 bg-blue-600 hover:bg-blue-700 text-white transition-all hover:scale-105 active:scale-95"
          >
            CHECK
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction('call')}
            disabled={callAmount > playerStack}
            className="font-bold text-xs h-10 bg-blue-600 hover:bg-blue-700 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            CALL {callAmount}
          </Button>
        )}
        
        <Button
          variant="default"
          size="sm"
          onClick={() => onAction('all_in')}
          className="font-bold text-xs h-10 bg-red-600 hover:bg-red-700 transition-all hover:scale-105 active:scale-95"
        >
          ALL IN
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
          />
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(Math.min(minRaise, maxBet))}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              Min
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(Math.min(Math.floor(maxBet * 0.33), maxBet))}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              1/3 Pot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(Math.min(Math.floor(maxBet * 0.5), maxBet))}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              1/2 Pot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBetAmount(maxBet)}
              className="text-[10px] h-7 transition-all hover:scale-105"
            >
              Max
            </Button>
          </div>
          <Button
            className="w-full font-bold text-sm h-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            onClick={() => onAction(currentBet === 0 ? 'bet' : 'raise', betAmount)}
            disabled={betAmount > maxBet}
          >
            {currentBet === 0 ? 'BET' : 'RAISE TO'} {betAmount}
          </Button>
        </div>
      )}
    </motion.div>
  );
}