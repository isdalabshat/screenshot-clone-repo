import { Lucky9Player, Lucky9Game } from '@/types/lucky9';
import { Lucky9PlayerSeat } from './Lucky9PlayerSeat';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9PlayerAvatar } from './Lucky9PlayerAvatar';
import { Lucky9CardDeck } from './Lucky9CardDeck';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Star, AlertTriangle } from 'lucide-react';

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
  
  // MANDATORY CARD REVEAL: Show all cards when winner is decided (finished/showdown status)
  const isGameFinished = game?.status === 'finished' || game?.status === 'showdown';
  // All cards MUST be visible once the game is finished - no hidden cards allowed
  const showAllCards = isShowdown || isGameFinished;
  
  const bankerCards = banker?.cards || [];
  const bankerValue = bankerCards.length > 0 ? calculateLucky9Value(bankerCards) : null;
  const bankerIsNatural = bankerCards.length === 2 && isNatural9(bankerCards);
  const isBankerTurn = game?.status === 'banker_turn';
  const isCurrentUserBanker = banker?.userId === currentUserId;

  // Calculate banker's total exposure (sum of all accepted bets)
  const totalExposure = nonBankerPlayers
    .filter(p => p.betAccepted === true)
    .reduce((sum, p) => sum + p.currentBet, 0);
  
  const isBettingPhase = game?.status === 'betting';

  return (
    <div className="relative w-full max-w-md mx-auto px-1">
      {/* Banker's Total Exposure Indicator - During Betting Phase */}
      {isBettingPhase && isCurrentUserBanker && totalExposure > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 mx-1"
        >
          <div className="bg-gradient-to-r from-amber-900/80 to-orange-900/80 border border-amber-500/50 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300 text-xs font-medium">Total Exposure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold text-sm">₱{totalExposure.toLocaleString()}</span>
                {banker && totalExposure > banker.stack && (
                  <Badge className="bg-red-600 text-[8px] px-1">Over Limit!</Badge>
                )}
              </div>
            </div>
            {banker && (
              <div className="mt-1 text-[10px] text-amber-400/70">
                Available: ₱{banker.stack.toLocaleString()} | {totalExposure <= banker.stack ? '✓ Can cover' : '✗ Cannot cover all bets'}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Banker section - Premium mobile-optimized design */}
      <div className="mb-2 px-1">
        {banker ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur rounded-xl p-2 border-2 transition-all ${
              isBankerTurn 
                ? 'border-yellow-400 shadow-md shadow-yellow-500/30' 
                : isGameFinished && banker.result === 'win'
                  ? 'border-green-400 shadow-md shadow-green-500/30'
                  : isGameFinished && banker.result === 'lose'
                    ? 'border-red-400/50'
                    : 'border-amber-600/40'
            }`}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-2xl" />
            
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-shrink">
                <div className="relative flex-shrink-0">
                  <Lucky9PlayerAvatar
                    username={banker.username}
                    isBanker
                    isMe={isCurrentUserBanker}
                    size="sm"
                    currentEmoji={playerEmojis[banker.userId] || null}
                    currentDecision={playerDecisions[banker.userId] || null}
                  />
                  <motion.div 
                    className="absolute -top-0.5 -right-0.5"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Crown className="h-3 w-3 text-amber-400 fill-amber-400" />
                  </motion.div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-amber-400 text-xs truncate max-w-[60px]">{banker.username}</span>
                    {isCurrentUserBanker && (
                      <Badge className="bg-purple-500/80 text-[7px] px-1 py-0">YOU</Badge>
                    )}
                  </div>
                  <span className="text-yellow-400 font-mono text-[10px] font-bold">₱{banker.stack.toLocaleString()}</span>
                </div>
              </div>

              {/* Banker Cards - MANDATORY: Always visible when game finished */}
              {bankerCards.length > 0 && (
                <div className="flex gap-1 items-center flex-shrink-0">
                  {bankerCards.map((card, i) => {
                    const shouldShow = showAllCards || isCurrentUserBanker;
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
                  {(showAllCards || isCurrentUserBanker) && bankerValue !== null && (
                    <div className="ml-1 text-center">
                      {bankerIsNatural && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[6px] flex items-center gap-0.5 shadow-lg px-1">
                            <Sparkles className="h-2 w-2" />
                            9!
                          </Badge>
                        </motion.div>
                      )}
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`text-lg font-bold ${bankerValue === 9 ? 'text-amber-400' : 'text-white'}`}
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
                  className="text-right flex-shrink-0"
                >
                  <Badge className={`text-[8px] font-bold ${
                    banker.result === 'win' ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 
                    banker.result === 'lose' ? 'bg-gradient-to-r from-red-500 to-red-400' : 
                    'bg-slate-500'
                  }`}>
                    {banker.result === 'win' ? '🏆' : banker.result === 'lose' ? '💔' : '↔'}
                  </Badge>
                  {banker.winnings !== 0 && (
                    <motion.div 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={`text-[10px] font-bold ${banker.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}
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
            className="bg-slate-900/50 rounded-xl p-3 border-2 border-dashed border-amber-500/30 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-amber-400/60">
              <Crown className="h-4 w-4" />
              <span className="text-xs font-medium">Waiting for Banker...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Table felt - Landscape rectangle for mobile */}
      <div className="relative w-full aspect-[16/9] max-w-[320px] mx-auto">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-0 rounded-2xl bg-gradient-to-b from-green-600 via-green-700 to-green-900 border-4 border-amber-700 shadow-xl shadow-black/60"
        >
          {/* Inner border decorations */}
          <div className="absolute inset-2 rounded-xl border border-amber-600/30" />
          <div className="absolute inset-4 rounded-lg border border-green-500/30" />
          
          {/* Center logo with glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <motion.div
              animate={{ opacity: [0.15, 0.25, 0.15] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="text-green-400/30 text-base font-bold tracking-wider">LUCKY</div>
              <div className="text-green-400/40 text-2xl font-black">9</div>
            </motion.div>
          </div>
          
          {/* Ambient light effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none" />
        </motion.div>

        {/* Card Deck with glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5">
          <motion.div
            animate={{ 
              boxShadow: isDealing 
                ? '0 0 30px rgba(255, 215, 0, 0.5)' 
                : '0 0 15px rgba(0, 0, 0, 0.5)'
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
                  boxShadow: ['0 0 20px rgba(251, 191, 36, 0.5)', '0 0 40px rgba(251, 191, 36, 0.8)', '0 0 20px rgba(251, 191, 36, 0.5)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-4 py-1.5 rounded-full shadow-xl"
              >
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-black fill-black" />
                  <span className="text-sm font-black text-black tracking-wider">RESULTS</span>
                  <Star className="h-3 w-3 text-black fill-black" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player positions - Mobile optimized */}
      <div className="mt-2 px-1">
        <div className="flex flex-wrap justify-center gap-1.5">
          {nonBankerPlayers.map((player, index) => {
            const isCurrentTurn = game?.status === 'player_turns' && game.currentPlayerPosition === player.position;
            const isMe = player.userId === currentUserId;
            // MANDATORY REVEAL: All cards shown when game finished, otherwise only player sees their own
            const shouldShowCards = isMe || showAllCards;
            
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
            className="text-center py-4"
          >
            <div className="inline-flex items-center gap-2 text-green-500/50 bg-green-500/5 px-3 py-1.5 rounded-full">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                ⏳
              </motion.div>
              <span className="text-xs">Waiting for players...</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
