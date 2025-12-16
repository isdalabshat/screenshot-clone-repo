import { Player } from '@/types/poker';
import { cn } from '@/lib/utils';
import PlayingCard from './PlayingCard';
import { Badge } from '@/components/ui/badge';

interface PlayerSeatProps {
  player?: Player;
  position: number;
  isCurrentUser?: boolean;
  showCards?: boolean;
}

// Position configurations for 9 players around an oval table
const positionStyles: Record<number, string> = {
  0: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  1: 'bottom-[15%] left-[5%]',
  2: 'top-1/2 left-0 -translate-y-1/2 -translate-x-1/2',
  3: 'top-[15%] left-[5%]',
  4: 'top-0 left-1/3 -translate-y-1/2',
  5: 'top-0 right-1/3 -translate-y-1/2',
  6: 'top-[15%] right-[5%]',
  7: 'top-1/2 right-0 -translate-y-1/2 translate-x-1/2',
  8: 'bottom-[15%] right-[5%]',
};

export default function PlayerSeat({ player, position, isCurrentUser = false, showCards = false }: PlayerSeatProps) {
  if (!player) {
    return (
      <div className={cn('absolute', positionStyles[position])}>
        <div className="w-24 h-24 rounded-full bg-muted/30 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Empty</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('absolute', positionStyles[position])}>
      <div 
        className={cn(
          'flex flex-col items-center gap-2',
          player.isCurrentPlayer && 'animate-pulse'
        )}
      >
        {/* Hole Cards */}
        {player.holeCards.length > 0 && (
          <div className="flex gap-1 mb-1">
            {player.holeCards.map((card, i) => (
              <PlayingCard 
                key={i} 
                card={showCards || isCurrentUser ? card : undefined}
                faceDown={!showCards && !isCurrentUser}
                size="sm"
                animationDelay={i * 100}
              />
            ))}
          </div>
        )}

        {/* Player Avatar */}
        <div 
          className={cn(
            'w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg border-2 transition-all duration-300',
            player.isFolded ? 'bg-muted/50 border-muted text-muted-foreground opacity-50' :
            player.isCurrentPlayer ? 'bg-emerald-900 border-emerald-400 ring-4 ring-emerald-400/50' :
            isCurrentUser ? 'bg-blue-900 border-blue-400' :
            'bg-slate-800 border-slate-600'
          )}
        >
          <span className="font-bold text-sm truncate max-w-[70px]">{player.username}</span>
          <span className="text-xs text-yellow-400 font-mono">{player.stack.toLocaleString()}</span>
        </div>

        {/* Position badges */}
        <div className="flex gap-1">
          {player.isDealer && (
            <Badge className="bg-white text-black text-xs px-1.5">D</Badge>
          )}
          {player.isSmallBlind && (
            <Badge className="bg-blue-500 text-white text-xs px-1.5">SB</Badge>
          )}
          {player.isBigBlind && (
            <Badge className="bg-orange-500 text-white text-xs px-1.5">BB</Badge>
          )}
          {player.isAllIn && (
            <Badge className="bg-red-500 text-white text-xs">ALL IN</Badge>
          )}
        </div>

        {/* Current bet */}
        {player.currentBet > 0 && !player.isFolded && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
            <div className="bg-yellow-500/90 text-black px-2 py-0.5 rounded text-xs font-bold">
              {player.currentBet}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
