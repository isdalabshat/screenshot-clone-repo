import { useState } from 'react';
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
  const [betAmount, setBetAmount] = useState(Math.max(currentBet * 2, bigBlind));
  
  const callAmount = currentBet - playerBet;
  const minRaise = currentBet + bigBlind;
  const maxBet = playerStack + playerBet;

  if (!isCurrentPlayer) {
    return (
      <div className="bg-card/80 backdrop-blur border border-border rounded-lg p-4 text-center">
        <p className="text-muted-foreground">Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="bg-card/80 backdrop-blur border border-emerald-700/30 rounded-lg p-4 space-y-4">
      <div className="flex gap-2 justify-center">
        <Button 
          variant="destructive" 
          onClick={() => onAction('fold')}
          className="px-8"
        >
          Fold
        </Button>
        
        {canCheck ? (
          <Button 
            variant="secondary" 
            onClick={() => onAction('check')}
            className="px-8"
          >
            Check
          </Button>
        ) : (
          <Button 
            variant="secondary" 
            onClick={() => onAction('call')}
            disabled={callAmount > playerStack}
            className="px-8"
          >
            Call {callAmount}
          </Button>
        )}
        
        {playerStack > callAmount && (
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 px-8"
            onClick={() => onAction(currentBet === 0 ? 'bet' : 'raise', betAmount)}
          >
            {currentBet === 0 ? 'Bet' : 'Raise'} {betAmount}
          </Button>
        )}
        
        <Button 
          variant="outline" 
          onClick={() => onAction('all_in')}
          className="px-8 border-red-500 text-red-500 hover:bg-red-500/10"
        >
          All In ({playerStack})
        </Button>
      </div>

      {playerStack > callAmount && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Bet amount:</span>
            <span className="font-bold text-foreground">{betAmount}</span>
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
            <span>Max: {maxBet}</span>
          </div>
        </div>
      )}
    </div>
  );
}
