import { Player, Card } from '@/types/poker';
import PlayerSeat from './PlayerSeat';
import PlayingCard from './PlayingCard';
import { cn } from '@/lib/utils';

interface PokerTableProps {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentUserId?: string;
  showdown?: boolean;
}

export default function PokerTableComponent({ 
  players, 
  communityCards, 
  pot, 
  currentUserId,
  showdown = false 
}: PokerTableProps) {
  // Create a full 9-seat array
  const seats: (Player | undefined)[] = Array(9).fill(undefined);
  players.forEach(player => {
    if (player.position >= 0 && player.position < 9) {
      seats[player.position] = player;
    }
  });

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[16/10]">
      {/* Table Surface */}
      <div className="absolute inset-8 rounded-[50%] bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 border-[12px] border-amber-900 shadow-2xl">
        {/* Table felt pattern */}
        <div className="absolute inset-0 rounded-[50%] opacity-10 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
        
        {/* Center area - pot and community cards */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {/* Pot display */}
          <div className="bg-black/30 px-6 py-2 rounded-full backdrop-blur">
            <span className="text-yellow-400 font-bold text-xl">
              Pot: {pot.toLocaleString()}
            </span>
          </div>

          {/* Community Cards */}
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn(
                'transition-all duration-500',
                communityCards[i] ? 'opacity-100 scale-100' : 'opacity-30 scale-95'
              )}>
                {communityCards[i] ? (
                  <PlayingCard 
                    card={communityCards[i]} 
                    size="md"
                    animationDelay={i * 150}
                  />
                ) : (
                  <div className="w-14 h-20 rounded-lg border-2 border-dashed border-emerald-500/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Player Seats */}
      {seats.map((player, position) => (
        <PlayerSeat
          key={position}
          player={player}
          position={position}
          isCurrentUser={player?.userId === currentUserId}
          showCards={showdown}
        />
      ))}
    </div>
  );
}
