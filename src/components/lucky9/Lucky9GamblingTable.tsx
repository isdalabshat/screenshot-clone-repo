import { Lucky9Player, Lucky9Game } from '@/types/lucky9';
import { Lucky9PlayerSeat } from './Lucky9PlayerSeat';
import { Lucky9Card } from './Lucky9Card';
import { calculateLucky9Value } from '@/lib/lucky9/deck';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';

interface Lucky9GamblingTableProps {
  players: Lucky9Player[];
  banker: Lucky9Player | null;
  game: Lucky9Game | null;
  currentUserId: string | undefined;
}

export function Lucky9GamblingTable({ players, banker, game, currentUserId }: Lucky9GamblingTableProps) {
  const nonBankerPlayers = players.filter(p => !p.isBanker);
  const showAllCards = game?.status === 'showdown' || game?.status === 'finished';
  const showBankerCards = game?.status === 'banker_turn' || showAllCards;
  
  // Calculate positions around an oval table
  const getPlayerPosition = (index: number, total: number) => {
    // Distribute players in a semi-circle at the bottom
    const angleStart = 200; // degrees
    const angleEnd = 340; // degrees
    const angleRange = angleEnd - angleStart;
    const angle = angleStart + (index / Math.max(1, total - 1)) * angleRange;
    const radian = (angle * Math.PI) / 180;
    
    const radiusX = 42;
    const radiusY = 35;
    
    return {
      left: `${50 + radiusX * Math.cos(radian)}%`,
      top: `${50 + radiusY * Math.sin(radian)}%`,
    };
  };

  const bankerCards = banker?.cards || [];
  const bankerValue = bankerCards.length > 0 ? calculateLucky9Value(bankerCards) : null;

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[16/10]">
      {/* Table felt */}
      <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-green-800 to-green-900 border-8 border-amber-900 shadow-2xl shadow-black/50">
        {/* Inner border */}
        <div className="absolute inset-3 rounded-[50%] border-2 border-amber-700/50" />
        
        {/* Table pattern */}
        <div className="absolute inset-6 rounded-[50%] border border-green-700/30" />
        
        {/* Center logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-700/30 text-6xl font-bold">
          LUCKY 9
        </div>
      </div>

      {/* Banker Position (Top Center) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-2 left-1/2 -translate-x-1/2 z-10"
      >
        {banker ? (
          <div className={`bg-slate-900/90 backdrop-blur rounded-xl p-3 border-2 ${
            game?.status === 'banker_turn' 
              ? 'border-yellow-400 shadow-lg shadow-yellow-500/30' 
              : 'border-amber-600'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-5 w-5 text-amber-400" />
              <span className="font-bold text-amber-400">{banker.username}</span>
              {banker.userId === currentUserId && (
                <Badge className="bg-purple-500 text-xs">You</Badge>
              )}
            </div>
            
            <div className="text-center mb-2">
              <span className="text-yellow-400 font-mono">₱{banker.stack.toLocaleString()}</span>
            </div>

            {/* Banker Cards */}
            {bankerCards.length > 0 && (
              <div className="flex gap-1 justify-center">
                {bankerCards.map((card, i) => {
                  const shouldHide = !showAllCards && i === 1 && banker.userId !== currentUserId;
                  return (
                    <Lucky9Card 
                      key={i} 
                      card={shouldHide ? '' : card} 
                      hidden={shouldHide}
                      delay={i * 0.1} 
                      small 
                    />
                  );
                })}
              </div>
            )}

            {/* Banker value - only show to banker or at showdown */}
            {bankerCards.length > 0 && (showAllCards || banker.userId === currentUserId) && bankerValue !== null && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 text-center"
              >
                <span className={`text-lg font-bold ${bankerValue === 9 ? 'text-amber-400' : 'text-white'}`}>
                  Value: {bankerValue}
                </span>
              </motion.div>
            )}

            {/* Banker turn indicator */}
            {game?.status === 'banker_turn' && banker.userId === currentUserId && !banker.hasActed && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="mt-2"
              >
                <Badge className="bg-yellow-500 text-black w-full justify-center">Your Turn!</Badge>
              </motion.div>
            )}

            {/* Result */}
            {banker.result && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 text-center"
              >
                <Badge className={
                  banker.result === 'win' ? 'bg-green-500' : 
                  banker.result === 'lose' ? 'bg-red-500' : 'bg-slate-500'
                }>
                  {banker.result === 'win' ? '✓ Won' : banker.result === 'lose' ? '✗ Lost' : '↔ Push'}
                </Badge>
                {banker.winnings !== 0 && (
                  <div className={`font-bold ${banker.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {banker.winnings > 0 ? '+' : ''}₱{banker.winnings.toLocaleString()}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/50 backdrop-blur rounded-xl p-4 border-2 border-dashed border-amber-500/50">
            <div className="flex items-center gap-2 text-amber-400/70">
              <Crown className="h-5 w-5" />
              <span>Waiting for Banker...</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Player Positions */}
      {nonBankerPlayers.map((player, index) => {
        const position = getPlayerPosition(index, nonBankerPlayers.length);
        const isCurrentTurn = game?.status === 'player_turns' && game.currentPlayerPosition === player.position;
        const isMe = player.userId === currentUserId;
        
        return (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: position.left, top: position.top }}
          >
            <Lucky9PlayerSeat
              player={player}
              isCurrentTurn={isCurrentTurn}
              showCards={isMe || showAllCards}
              gameStatus={game?.status || 'betting'}
              isMe={isMe}
            />
          </motion.div>
        );
      })}

      {/* Empty seats */}
      {nonBankerPlayers.length === 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-green-600/50 text-lg">
          Waiting for players to join...
        </div>
      )}
    </div>
  );
}
