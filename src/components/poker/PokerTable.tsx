import { Player, Card, Game } from '@/types/poker';
import PlayerSeat from './PlayerSeat';
import PlayingCard from './PlayingCard';
import { cn } from '@/lib/utils';

interface PokerTableProps {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentUserId?: string;
  gameStatus?: Game['status'];
  myCards?: Card[];
  turnTimeLeft?: number | null;
}

// Get how many community cards to show based on game status
const getVisibleCards = (status: Game['status'] | undefined): number => {
  switch (status) {
    case 'flop': return 3;
    case 'turn': return 4;
    case 'river': return 5;
    case 'showdown': return 5;
    default: return 0;
  }
};

export default function PokerTableComponent({ 
  players, 
  communityCards, 
  pot, 
  currentUserId,
  gameStatus,
  myCards = [],
  turnTimeLeft
}: PokerTableProps) {
  // Create a full 9-seat array
  const seats: (Player | undefined)[] = Array(9).fill(undefined);
  players.forEach(player => {
    if (player.position >= 0 && player.position < 9) {
      seats[player.position] = player;
    }
  });

  const visibleCardCount = getVisibleCards(gameStatus);
  const isShowdown = gameStatus === 'showdown';

  // Find current turn player for display
  const currentTurnPlayer = players.find(p => p.isCurrentPlayer);

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[3/4]">
      {/* Table Surface - Portrait oval */}
      <div className="absolute inset-4 rounded-[45%/35%] bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 border-[8px] border-amber-900 shadow-2xl">
        {/* Table felt pattern */}
        <div className="absolute inset-0 rounded-[45%/35%] opacity-10 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
        
        {/* Center area - pot and community cards */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          {/* Current turn indicator */}
          {currentTurnPlayer && gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-bold animate-pulse',
              turnTimeLeft !== null && turnTimeLeft <= 10 
                ? 'bg-red-600 text-white' 
                : 'bg-emerald-500 text-white'
            )}>
              {currentTurnPlayer.username}'s Turn
              {turnTimeLeft !== null && ` (${turnTimeLeft}s)`}
            </div>
          )}

          {/* Pot display */}
          <div className="bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-sm border border-yellow-500/30">
            <span className="text-yellow-400 font-bold text-sm">
              Pot: {pot.toLocaleString()}
            </span>
          </div>

          {/* Community Cards */}
          <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn(
                'transition-all duration-300',
                i < visibleCardCount && communityCards[i] ? 'opacity-100 scale-100' : 'opacity-30 scale-95'
              )}>
                {i < visibleCardCount && communityCards[i] ? (
                  <PlayingCard card={communityCards[i]} size="sm" />
                ) : (
                  <div className="w-8 h-12 rounded border border-dashed border-emerald-500/30" />
                )}
              </div>
            ))}
          </div>

          {/* Game status indicator */}
          {gameStatus && gameStatus !== 'waiting' && gameStatus !== 'complete' && (
            <div className="bg-emerald-900/70 px-3 py-0.5 rounded-full text-emerald-300 text-xs font-medium uppercase tracking-wider">
              {gameStatus}
            </div>
          )}
        </div>
      </div>

      {/* Player Seats - Portrait layout */}
      {seats.map((player, position) => (
        <PlayerSeat
          key={position}
          player={player}
          position={position}
          isCurrentUser={player?.userId === currentUserId}
          showCards={isShowdown}
          myCards={player?.userId === currentUserId ? myCards : undefined}
          communityCards={communityCards}
          gameStatus={gameStatus}
        />
      ))}
    </div>
  );
}
