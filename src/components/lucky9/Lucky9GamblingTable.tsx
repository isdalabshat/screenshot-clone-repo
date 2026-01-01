import { Lucky9Player, Lucky9Game } from '@/types/lucky9';
import { Lucky9PlayerSeat } from './Lucky9PlayerSeat';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9PlayerAvatar } from './Lucky9PlayerAvatar';
import { Lucky9CardDeck } from './Lucky9CardDeck';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Star } from 'lucide-react';

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
  
  // Show all cards when: finished status (winner decided), showdown, or any natural 9
  const isGameFinished = game?.status === 'finished' || game?.status === 'showdown';
  const showAllCards = isShowdown || isGameFinished;
  
  const bankerCards = banker?.cards || [];
  const bankerValue = bankerCards.length > 0 ? calculateLucky9Value(bankerCards) : null;
  const bankerIsNatural = bankerCards.length === 2 && isNatural9(bankerCards);
  const isBankerTurn = game?.status === 'banker_turn';
  const isCurrentUserBanker = banker?.userId === currentUserId;
  
  // Check if any player or banker has natural 9 - reveal their cards to all
  const anyNatural9 = bankerIsNatural || nonBankerPlayers.some(p => p.isNatural);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Banker section - Premium design */}
      <div className="mb-3 px-2">
        {banker ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur rounded-2xl p-3 border-2 transition-all ${
              isBankerTurn 
                ? 'border-yellow-400 shadow-lg shadow-yellow-500/30' 
                : isGameFinished && banker.result === 'win'
                  ? 'border-green-400 shadow-lg shadow-green-500/30'
                  : isGameFinished && banker.result === 'lose'
                    ? 'border-red-400/50'
                    : 'border-amber-600/40'
            }`}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-tr from-yellow-500/10 to-transparent rounded-full blur-xl" />
            
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <Lucky9PlayerAvatar
                    username={banker.username}
                    isBanker
                    isMe={isCurrentUserBanker}
                    size="md"
                    currentEmoji={playerEmojis[banker.userId] || null}
                    currentDecision={playerDecisions[banker.userId] || null}
                  />
                  <motion.div 
                    className="absolute -top-1 -right-1"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Crown className="h-4 w-4 text-amber-400 fill-amber-400" />
                  </motion.div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 text-sm truncate">{banker.username}</span>
                    {isCurrentUserBanker && (
                      <Badge className="bg-purple-500/80 text-[9px] px-1.5 py-0">YOU</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 font-mono text-xs font-bold">₱{banker.stack.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Banker Cards - Always visible when game finished */}
              {bankerCards.length > 0 && (
                <div className="flex gap-1.5 items-center">
                  {bankerCards.map((card, i) => {
                    // Show banker cards if: game finished, banker is me, OR banker has natural 9
                    const shouldShow = showAllCards || isCurrentUserBanker || bankerIsNatural;
                    const canReveal = isCurrentUserBanker && isBankerTurn && !banker?.hasActed;
                    return (
                      <Lucky9RevealableCard 
                        key={i} 
                        card={card} 
                        hidden={!shouldShow}
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
                          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[8px] flex items-center gap-0.5 shadow-lg">
                            <Sparkles className="h-2.5 w-2.5" />
                            Natural 9!
                          </Badge>
                        </motion.div>
                      )}
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`text-xl font-bold ${bankerValue === 9 ? 'text-amber-400' : 'text-white'}`}
                      >
                        {bankerValue}
                      </motion.div>
                    </div>
                  )}
                </div>
              )}

              {/* Banker result with animation */}
              {banker.result && isGameFinished && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-right"
                >
                  <Badge className={`text-xs font-bold ${
                    banker.result === 'win' ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 
                    banker.result === 'lose' ? 'bg-gradient-to-r from-red-500 to-red-400' : 
                    'bg-slate-500'
                  }`}>
                    {banker.result === 'win' ? '🏆 WIN' : banker.result === 'lose' ? '💔 LOSE' : '↔ PUSH'}
                  </Badge>
                  {banker.winnings !== 0 && (
                    <motion.div 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={`text-sm font-bold mt-1 ${banker.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {banker.winnings > 0 ? '+' : ''}₱{banker.winnings.toLocaleString()}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-slate-900/50 rounded-2xl p-4 border-2 border-dashed border-amber-500/30 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-amber-400/60">
              <Crown className="h-5 w-5" />
              <span className="text-sm font-medium">Waiting for Banker...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Table felt - Enhanced design */}
      <div className="relative w-full aspect-square max-w-xs mx-auto">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-0 rounded-full bg-gradient-to-b from-green-600 via-green-700 to-green-900 border-[6px] border-amber-700 shadow-2xl shadow-black/60"
        >
          {/* Inner ring decorations */}
          <div className="absolute inset-3 rounded-full border-2 border-amber-600/30" />
          <div className="absolute inset-6 rounded-full border border-green-500/30" />
          <div className="absolute inset-10 rounded-full border border-green-400/20" />
          
          {/* Center logo with glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <motion.div
              animate={{ opacity: [0.15, 0.25, 0.15] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="text-green-400/30 text-2xl font-bold tracking-wider drop-shadow-lg">LUCKY</div>
              <div className="text-green-400/40 text-5xl font-black drop-shadow-lg">9</div>
            </motion.div>
          </div>
          
          {/* Ambient light effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none" />
        </motion.div>

        {/* Card Deck with glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5">
          <motion.div
            animate={{ 
              boxShadow: isDealing 
                ? '0 0 40px rgba(255, 215, 0, 0.5)' 
                : '0 0 20px rgba(0, 0, 0, 0.5)'
            }}
            className="rounded-lg"
          >
            <Lucky9CardDeck isDealing={isDealing} />
          </motion.div>
        </div>

        {/* Winner announcement overlay */}
        <AnimatePresence>
          {isGameFinished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  boxShadow: ['0 0 30px rgba(251, 191, 36, 0.5)', '0 0 50px rgba(251, 191, 36, 0.8)', '0 0 30px rgba(251, 191, 36, 0.5)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-6 py-2 rounded-full shadow-2xl"
              >
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-black fill-black" />
                  <span className="text-base font-black text-black tracking-wider">RESULTS</span>
                  <Star className="h-4 w-4 text-black fill-black" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player positions - Enhanced cards */}
      <div className="mt-3 px-2">
        <div className="flex flex-wrap justify-center gap-2">
          {nonBankerPlayers.map((player, index) => {
            const isCurrentTurn = game?.status === 'player_turns' && game.currentPlayerPosition === player.position;
            const isMe = player.userId === currentUserId;
            // Show cards if: it's me, game finished, or player has natural 9
            const shouldShowCards = isMe || showAllCards || player.isNatural;
            
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
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

        {/* Empty state with better styling */}
        {nonBankerPlayers.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6"
          >
            <div className="inline-flex items-center gap-2 text-green-500/50 bg-green-500/5 px-4 py-2 rounded-full">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                ⏳
              </motion.div>
              <span className="text-sm">Waiting for players to join...</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
