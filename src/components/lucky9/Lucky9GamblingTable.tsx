import { Lucky9Player, Lucky9Game } from '@/types/lucky9';
import { Lucky9PlayerSeat } from './Lucky9PlayerSeat';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9PlayerAvatar } from './Lucky9PlayerAvatar';
import { Lucky9CardDeck } from './Lucky9CardDeck';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles } from 'lucide-react';

interface PlayerEmojiState {
  [playerId: string]: string | null;
}

interface PlayerDecisionState {
  [playerId: string]: 'hirit' | 'good' | null;
}

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
  playerEmojis?: PlayerEmojiState;
  playerDecisions?: PlayerDecisionState;
  isDealing?: boolean;
  isShowdown?: boolean;
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
  onCardReveal,
  playerEmojis = {},
  playerDecisions = {},
  isDealing = false,
  isShowdown = false
}: Lucky9GamblingTableProps) {
  const nonBankerPlayers = players.filter(p => !p.isBanker);
  
  // Showdown: show all cards, including during showdown and finished states
  const showAllCards = isShowdown || game?.status === 'showdown' || game?.status === 'finished';
  
  const bankerCards = banker?.cards || [];
  const bankerValue = bankerCards.length > 0 ? calculateLucky9Value(bankerCards) : null;
  const bankerIsNatural = bankerCards.length === 2 && isNatural9(bankerCards);
  const isBankerTurn = game?.status === 'banker_turn';
  const isCurrentUserBanker = banker?.userId === currentUserId;
  
  // Check if any player or banker has natural 9 - reveal their cards to all
  const anyNatural9 = bankerIsNatural || nonBankerPlayers.some(p => p.isNatural);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Banker section - OUTSIDE the table, compact */}
      <div className="mb-2 px-2">
        {banker ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-slate-900/90 backdrop-blur rounded-lg p-2 border transition-all ${
              isBankerTurn 
                ? 'border-yellow-400 shadow-md shadow-yellow-500/30' 
                : 'border-amber-600/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Lucky9PlayerAvatar
                  username={banker.username}
                  isBanker
                  isMe={isCurrentUserBanker}
                  size="sm"
                  currentEmoji={playerEmojis[banker.userId] || null}
                  currentDecision={playerDecisions[banker.userId] || null}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400 text-xs truncate">{banker.username}</span>
                    {isCurrentUserBanker && <Badge className="bg-purple-500 text-[8px] px-1">YOU</Badge>}
                  </div>
                  <span className="text-yellow-400 font-mono text-[10px]">₱{banker.stack.toLocaleString()}</span>
                </div>
              </div>

              {/* Banker Cards */}
              {bankerCards.length > 0 && (
                <div className="flex gap-1 items-center">
                  {bankerCards.map((card, i) => {
                    // Show banker cards if: showdown, finished, banker is me, OR banker has natural 9
                    const shouldHide = !showAllCards && !isCurrentUserBanker && !bankerIsNatural;
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
                  {(showAllCards || isCurrentUserBanker || bankerIsNatural) && bankerValue !== null && (
                    <div className="ml-2 text-center">
                      {bankerIsNatural && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[8px] flex items-center gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" />
                            Natural 9!
                          </Badge>
                        </motion.div>
                      )}
                      <div className={`text-lg font-bold ${bankerValue === 9 ? 'text-amber-400' : 'text-white'}`}>
                        {bankerValue}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Banker result */}
              {banker.result && (
                <div className="text-right">
                  <Badge className={`text-[8px] ${banker.result === 'win' ? 'bg-green-500' : banker.result === 'lose' ? 'bg-red-500' : 'bg-slate-500'}`}>
                    {banker.result === 'win' ? '✓' : banker.result === 'lose' ? '✗' : '↔'}
                  </Badge>
                  {banker.winnings !== 0 && (
                    <div className={`text-[10px] font-bold ${banker.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {banker.winnings > 0 ? '+' : ''}₱{banker.winnings.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="bg-slate-900/50 rounded-lg p-2 border border-dashed border-amber-500/30 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-400/60">
              <Crown className="h-3 w-3" />
              <span className="text-xs">Waiting for Banker...</span>
            </div>
          </div>
        )}
      </div>

      {/* Table felt - smaller, centered */}
      <div className="relative w-full aspect-square max-w-xs mx-auto">
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-green-700 to-green-900 border-4 border-amber-800 shadow-xl shadow-black/50">
          <div className="absolute inset-2 rounded-full border border-amber-700/30" />
          <div className="absolute inset-4 rounded-full border border-green-600/20" />
          
          {/* Center logo */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-green-600/20 text-xl font-bold tracking-wider">LUCKY</div>
            <div className="text-green-600/20 text-3xl font-bold">9</div>
          </div>
        </div>

        {/* Card Deck */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5">
          <Lucky9CardDeck isDealing={isDealing} />
        </div>

        {/* Showdown overlay */}
        <AnimatePresence>
          {showAllCards && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                className="bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-1.5 rounded-full shadow-lg"
              >
                <span className="text-sm font-bold text-black tracking-wider">SHOWDOWN</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player positions - OUTSIDE the table, at bottom */}
      <div className="mt-2 px-2">
        <div className="flex flex-wrap justify-center gap-2">
          {nonBankerPlayers.map((player, index) => {
            const isCurrentTurn = game?.status === 'player_turns' && game.currentPlayerPosition === player.position;
            const isMe = player.userId === currentUserId;
            // Show cards if: it's me, showdown, player has natural 9
            const shouldShowCards = isMe || showAllCards || player.isNatural;
            
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Lucky9PlayerSeat
                  player={player}
                  isCurrentTurn={isCurrentTurn}
                  showCards={shouldShowCards}
                  gameStatus={game?.status || 'betting'}
                  isMe={isMe}
                  isBankerView={isBankerView}
                  onAcceptBet={onAcceptBet}
                  onRejectBet={onRejectBet}
                  isProcessing={isProcessing}
                  canRevealCards={isMe && isCurrentTurn && !player.hasActed}
                  onCardReveal={(cardIndex) => onCardReveal?.(player.id, cardIndex)}
                  currentEmoji={playerEmojis[player.userId] || null}
                  currentDecision={playerDecisions[player.userId] || null}
                  showNaturalBadge={player.isNatural}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {nonBankerPlayers.length === 0 && (
          <div className="text-center py-4 text-green-500/40 text-sm">
            Waiting for players to join...
          </div>
        )}
      </div>
    </div>
  );
}
