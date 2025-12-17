import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ActionType } from '@/types/poker';

interface ActionButtonsProps {
  currentBet: number;
  playerBet: number;
  playerStack: number;
  bigBlind: number;
  canCheck: boolean;
  isCurrentPlayer: boolean;
  onAction: (action: ActionType, amount?: number) => void;
}

export default function ActionButtons({
  currentBet,
  playerBet,
  playerStack,
  bigBlind,
  canCheck,
  isCurrentPlayer,
  onAction
}: ActionButtonsProps) {
  const callAmount = Math.min(currentBet - playerBet, playerStack);
  const minRaise = Math.max(currentBet + bigBlind, bigBlind * 2);
  const maxBet = playerStack + playerBet;
  
  const [betAmount, setBetAmount] = useState(minRaise);

  // Reset bet amount when turn changes or bet changes
  useEffect(() => {
    setBetAmount(Math.min(minRaise, maxBet));
  }, [minRaise, maxBet, currentBet]);

  if (!isCurrentPlayer) {
    return (
      <div className="bg-card/80 backdrop-blur border border-border rounded-lg p-6 text-center">
        <p className="text-muted-foreground text-lg">Waiting for other players...</p>
      </div>
    );
  }

  const canRaise = playerStack > callAmount && maxBet > minRaise;

  return (
    <div className="bg-card/90 backdrop-blur border border-emerald-700/50 rounded-xl p-6 space-y-4 shadow-2xl">
      <div className="text-center mb-4">
        <p className="text-emerald-400 font-bold text-lg">Your Turn!</p>
        <p className="text-muted-foreground text-sm">Choose your action</p>
      </div>

      <div className="flex gap-3 justify-center flex-wrap">
        <Button 
          variant="destructive" 
          onClick={() => onAction('fold')}
          className="px-6 py-3 text-lg font-bold"
          size="lg"
        >
          Fold
        </Button>
        
        {canCheck ? (
          <Button 
            variant="secondary" 
            onClick={() => onAction('check')}
            className="px-6 py-3 text-lg font-bold"
            size="lg"
          >
            Check
          </Button>
        ) : callAmount > 0 && (
          <Button 
            variant="secondary" 
            onClick={() => onAction('call')}
            disabled={callAmount > playerStack}
            className="px-6 py-3 text-lg font-bold"
            size="lg"
          >
            Call {callAmount}
          </Button>
        )}
        
        {canRaise && (
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 px-6 py-3 text-lg font-bold"
            onClick={() => onAction(currentBet === 0 ? 'bet' : 'raise', betAmount)}
            size="lg"
          >
            {currentBet === 0 ? 'Bet' : 'Raise to'} {betAmount}
          </Button>
        )}
        
        <Button 
          variant="outline" 
          onClick={() => onAction('all_in')}
          className="px-6 py-3 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-lg font-bold"
          size="lg"
        >
          All In ({playerStack})
        </Button>
      </div>

      {canRaise && (
        <div className="space-y-3 pt-4 border-t border-border/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bet/Raise amount:</span>
            <span className="font-bold text-emerald-400 text-lg">{betAmount}</span>
          </div>
          <Slider
            value={[betAmount]}
            onValueChange={([value]) => setBetAmount(value)}
            min={minRaise}
            max={maxBet}
            step={bigBlind}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: {minRaise}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setBetAmount(Math.min(minRaise * 2, maxBet))}
                className="px-2 py-1 bg-muted rounded hover:bg-muted/80"
              >
                2x
              </button>
              <button 
                onClick={() => setBetAmount(Math.min(minRaise * 3, maxBet))}
                className="px-2 py-1 bg-muted rounded hover:bg-muted/80"
              >
                3x
              </button>
              <button 
                onClick={() => setBetAmount(Math.floor(maxBet / 2))}
                className="px-2 py-1 bg-muted rounded hover:bg-muted/80"
              >
                1/2 Pot
              </button>
            </div>
            <span>Max: {maxBet}</span>
          </div>
        </div>
      )}
    </div>
  );
}
