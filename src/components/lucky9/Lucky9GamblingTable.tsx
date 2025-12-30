import { Lucky9Player, Lucky9Game } from '@/types/lucky9';
import { Lucky9PlayerSeat } from './Lucky9PlayerSeat';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9ChipStack } from './Lucky9BetAnimation';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';

interface Lucky9GamblingTableProps {
  players: Lucky9Player[];
  banker: Lucky9Player | null;
  game: Lucky9Game | null;
  currentUserId: string | undefined;
  isBankerView?: boolean;
  onAcceptBet?: (playerId: string) => void;
  onRejectBet?: (playerId: string) => void;
  isProcessing?: boolean;
  onCardReveal?: (playerId: string, cardIndex: number) => void;
}

export function Lucky9GamblingTable({ 
  players, 
  banker, 
  game, 
  currentUserId,
  isBankerView,
  onAcceptBet,
  onRejectBet,
  isProcessing,
  onCardReveal
}: Lucky9GamblingTableProps) {
  const nonBankerPlayers = players.filter(p => !p.isBanker);
  const showAllCards = game?.status === 'showdown' || game?.status === 'finished';
  
  const bankerCards = banker?.cards || [];
  const bankerValue = bankerCards.length > 0 ? calculateLucky9Value(bankerCards) : null;
  const bankerIsNatural = bankerCards.length === 2 && isNatural9(bankerCards);
  const isBankerTurn = game?.status === 'banker_turn';
  const isCurrentUserBanker = banker?.userId === currentUserId;

  // Portrait layout positions for mobile - semi-circle at bottom
  const getPlayerPosition = (index: number, total: number) => {
    if (total === 1) {
      return { left: '50%', bottom: '8%' };
    }
    
    // Spread players in an arc at the bottom
    const positions = [
      { left: '15%', bottom: '20%' },
      { left: '50%', bottom: '5%' },
      { left: '85%', bottom: '20%' },
      { left: '8%', bottom: '40%' },
      { left: '92%', bottom: '40%' },
    ];
    
    return positions[index] || { left: '50%', bottom: '10%' };
  };

  return (
    <div className="relative w-full aspect-[3/4] max-w-md mx-auto">
      {/* Table felt - portrait oval */}
      <div className="absolute inset-0 rounded-[45%] bg-gradient-to-b from-green-700 to-green-900 border-[6px] border-amber-800 shadow-2xl shadow-black/60">
        {/* Inner decorative borders */}
        <div className="absolute inset-2 rounded-[45%] border-2 border-amber-700/40" />
        <div className="absolute inset-4 rounded-[45%] border border-green-600/30" />
        
        {/* Center logo */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="text-green-600/25 text-3xl font-bold tracking-wider">LUCKY</div>
          <div className="text-green-600/25 text-5xl font-bold">9</div>
        </div>
      </div>

      {/* Banker Position (Top Center) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-[8%] left-1/2 -translate-x-1/2 z-10 w-[85%]"
      >
        {banker ? (
          <div className={`bg-slate-900/95 backdrop-blur rounded-xl p-3 border-2 transition-all ${
            isBankerTurn 
              ? 'border-yellow-400 shadow-lg shadow-yellow-500/40 animate-pulse' 
              : 'border-amber-600'
          }`}>
            {/* Banker header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-amber-400 text-sm">{banker.username}</span>
                {isCurrentUserBanker && (
                  <Badge className="bg-purple-500 text-[10px] px-1.5">YOU</Badge>
                )}
              </div>
              <span className="text-yellow-400 font-mono text-sm">₱{banker.stack.toLocaleString()}</span>
            </div>

            {/* Banker Cards - HIDDEN FROM OTHER PLAYERS UNTIL SHOWDOWN */}
            {bankerCards.length > 0 && (
              <div className="flex gap-1.5 justify-center mb-2">
                {bankerCards.map((card, i) => {
                  // Hide ALL cards from non-banker players until showdown
                  const shouldHide = !showAllCards && !isCurrentUserBanker;
                  // Banker can slowly reveal their own cards during their turn
                  const canReveal = isCurrentUserBanker && isBankerTurn && !banker?.hasActed;
                  return (
                    <Lucky9RevealableCard 
                      key={i} 
                      card={card} 
                      hidden={shouldHide}
                      canReveal={canReveal}
                      delay={i * 0.1} 
                      small
                      onReveal={() => onCardReveal?.(banker?.id || '', i)}
                    />
                  );
                })}
              </div>
            )}

            {/* Banker value - visible to banker or at showdown */}
            {bankerCards.length > 0 && (showAllCards || isCurrentUserBanker) && bankerValue !== null && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                {bankerIsNatural && (
                  <Badge className="bg-amber-500 text-black text-[10px] mb-1">Natural 9!</Badge>
                )}
                <div className={`text-lg font-bold ${bankerValue === 9 ? 'text-amber-400' : 'text-white'}`}>
                  {bankerValue}
                </div>
              </motion.div>
            )}

            {/* Turn indicator for banker */}
            {isBankerTurn && isCurrentUserBanker && !banker.hasActed && (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="mt-1"
              >
                <Badge className="bg-yellow-500 text-black w-full justify-center text-xs">Your Turn!</Badge>
              </motion.div>
            )}

            {/* Result */}
            {banker.result && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 text-center"
              >
                <Badge className={`text-xs ${
                  banker.result === 'win' ? 'bg-green-500' : 
                  banker.result === 'lose' ? 'bg-red-500' : 'bg-slate-500'
                }`}>
                  {banker.result === 'win' ? '✓ Won' : banker.result === 'lose' ? '✗ Lost' : '↔ Push'}
                </Badge>
                {banker.winnings !== 0 && (
                  <div className={`text-sm font-bold ${banker.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {banker.winnings > 0 ? '+' : ''}₱{banker.winnings.toLocaleString()}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/50 backdrop-blur rounded-xl p-4 border-2 border-dashed border-amber-500/50 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-400/70">
              <Crown className="h-4 w-4" />
              <span className="text-sm">Waiting for Banker...</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Player Positions - around bottom arc */}
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
            className="absolute -translate-x-1/2 translate-y-1/2 z-10"
            style={{ left: position.left, bottom: position.bottom }}
          >
            <Lucky9PlayerSeat
              player={player}
              isCurrentTurn={isCurrentTurn}
              showCards={isMe || showAllCards}
              gameStatus={game?.status || 'betting'}
              isMe={isMe}
              isBankerView={isBankerView}
              onAcceptBet={onAcceptBet}
              onRejectBet={onRejectBet}
              isProcessing={isProcessing}
              canRevealCards={isMe && isCurrentTurn && !player.hasActed}
              onCardReveal={(cardIndex) => onCardReveal?.(player.id, cardIndex)}
            />
          </motion.div>
        );
      })}

      {/* Empty state */}
      {nonBankerPlayers.length === 0 && (
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 text-green-500/40 text-sm text-center">
          Waiting for<br />players to join...
        </div>
      )}
    </div>
  );
}
