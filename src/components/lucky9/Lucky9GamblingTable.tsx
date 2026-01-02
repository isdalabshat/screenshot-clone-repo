import { useState, useEffect, useMemo } from 'react';
import { Lucky9Player, Lucky9Game } from '@/types/lucky9';
import { Lucky9PlayerSeat } from './Lucky9PlayerSeat';
import { Lucky9RevealableCard } from './Lucky9RevealableCard';
import { Lucky9PlayerAvatar } from './Lucky9PlayerAvatar';
import { Lucky9CardDeck } from './Lucky9CardDeck';
import { calculateLucky9Value, isNatural9 } from '@/lib/lucky9/deck';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Star, AlertTriangle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  isSpectator?: boolean;
  isAdmin?: boolean;
  onAcceptBet?: (playerId: string) => void;
  onRejectBet?: (playerId: string) => void;
  onKickPlayer?: (playerId: string) => void;
  isProcessing?: boolean;
  onCardReveal?: (playerId: string, cardIndex: number) => void;
  playerEmojis?: PlayerEmojiState;
  playerDecisions?: PlayerDecisionState;
  isDealing?: boolean;
  isShowdown?: boolean;
  onGetPlayerSeatPosition?: (playerId: string) => { x: number; y: number } | null;
}

// Position styles for 5 player seats around the vertical oval table (poker-style layout)
// Position 0 = bottom center (current user - square panel), positions arranged clockwise
// Increased spacing to prevent avatar overlap - moved even further out
const seatPositionStyles: Record<number, string> = {
  0: 'bottom-[-8%] left-1/2 -translate-x-1/2',    // Bottom center - current user (moved down for square panel)
  1: 'bottom-[32%] left-[-14%]',                   // Bottom left - moved further out
  2: 'top-[12%] left-[-14%]',                      // Top left - moved further out
  3: 'top-[12%] right-[-14%]',                     // Top right - moved further out
  4: 'bottom-[32%] right-[-14%]',                  // Bottom right - moved further out
};

// Get display position based on user's actual position (rotate so user is always at bottom)
const getRotatedPosition = (actualPosition: number, userPosition: number, totalPlayers: number): number => {
  if (totalPlayers === 0) return actualPosition;
  const offset = userPosition - 1; // Player positions start at 1
  return ((actualPosition - 1 - offset + totalPlayers) % totalPlayers);
};

export function Lucky9GamblingTable({ 
  players, 
  banker, 
  game, 
  currentUserId,
  isBankerView,
  isSpectator = false,
  isAdmin = false,
  onAcceptBet,
  onRejectBet,
  onKickPlayer,
  isProcessing,
  onCardReveal,
  playerEmojis = {},
  playerDecisions = {},
  isDealing = false,
  isShowdown = false,
  onGetPlayerSeatPosition
}: Lucky9GamblingTableProps) {
  const nonBankerPlayers = players.filter(p => !p.isBanker);
  
  // MANDATORY CARD REVEAL: Show all cards when winner is decided or during reveal phase
  const isGameFinished = game?.status === 'finished' || game?.status === 'showdown' || game?.status === 'revealing' || game?.status === 'calculating';
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

  // Track banker decision display
  const [showBankerDecision, setShowBankerDecision] = useState(false);
  const bankerDecision = playerDecisions[banker?.userId || ''];

  useEffect(() => {
    if (bankerDecision) {
      setShowBankerDecision(true);
      const timer = setTimeout(() => setShowBankerDecision(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [bankerDecision]);

  // Check if banker is winner
  const bankerIsWinner = isGameFinished && (banker?.result === 'win' || banker?.result === 'natural_win');

  // Get current user's position for rotation
  const currentUserPlayer = nonBankerPlayers.find(p => p.userId === currentUserId);
  const userPosition = currentUserPlayer?.position ?? 1;

  // Create seat array with rotated positions
  const seats: (Lucky9Player | undefined)[] = Array(5).fill(undefined);
  nonBankerPlayers.forEach(player => {
    if (player.position >= 1 && player.position <= 5) {
      const displayPosition = isSpectator 
        ? player.position - 1  // Spectators see players in original positions
        : getRotatedPosition(player.position, userPosition, 5);
      if (displayPosition >= 0 && displayPosition < 5) {
        seats[displayPosition] = player;
      }
    }
  });

  return (
    <div className="relative w-full max-w-lg mx-auto px-2">
      {/* Spectator indicator */}
      {isSpectator && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 mx-1"
        >
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 border border-blue-500/50 rounded-lg px-3 py-2 flex items-center justify-center gap-2">
            <Eye className="h-4 w-4 text-blue-400" />
            <span className="text-blue-300 text-xs font-medium">Spectator Mode</span>
          </div>
        </motion.div>
      )}

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

      {/* Main Table Container - Taller vertical oval table for better spacing */}
      <div className="relative w-full max-w-[300px] mx-auto" style={{ aspectRatio: '2/3', minHeight: '400px' }}>
        {/* Ambient glow effect */}
        <div className="absolute inset-0 bg-gradient-radial from-green-900/20 via-transparent to-transparent pointer-events-none" />
        
        {/* Table Surface with Premium Felt - Vertical oval shape */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute inset-8 sm:inset-10 rounded-[45%/50%] border-[10px] sm:border-[12px] border-amber-900/95 shadow-2xl"
          style={{
            boxShadow: `
              inset 0 0 80px rgba(0,0,0,0.6), 
              0 0 50px rgba(0,0,0,0.7), 
              inset 0 0 30px rgba(34, 197, 94, 0.15),
              0 6px 24px rgba(0,0,0,0.5)
            `,
            background: 'radial-gradient(ellipse at 50% 40%, #1a5d3a 0%, #0f4228 40%, #0a2e1c 100%)'
          }}
        >
          {/* Table Rail - Multi-layer wood effect */}
          <div className="absolute -inset-[10px] sm:-inset-[12px] rounded-[45%/50%] border-4 border-amber-800/60 pointer-events-none" />
          <div className="absolute -inset-[6px] sm:-inset-[8px] rounded-[45%/50%] border-2 border-amber-600/30 pointer-events-none" />
          <div className="absolute -inset-[3px] sm:-inset-[4px] rounded-[45%/50%] border border-amber-500/10 pointer-events-none" />
          
          {/* Felt texture overlay */}
          <div className="absolute inset-0 rounded-[45%/50%] opacity-40 bg-[radial-gradient(circle_at_50%_40%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
          
          {/* Center logo with glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <motion.div
              animate={{ opacity: [0.15, 0.25, 0.15] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="text-green-400/30 text-sm font-bold tracking-wider">LUCKY</div>
              <div className="text-green-400/40 text-3xl font-black">9</div>
            </motion.div>
          </div>
          
          {/* Ambient light effect */}
          <div className="absolute inset-0 rounded-[45%/50%] bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none" />
        </motion.div>


        {/* Card Deck at center - even smaller size */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5 scale-50">
          <motion.div
            animate={{ 
              boxShadow: isDealing 
                ? '0 0 15px rgba(255, 215, 0, 0.4)' 
                : '0 0 8px rgba(0, 0, 0, 0.4)'
            }}
            className="rounded-lg"
          >
            <Lucky9CardDeck isDealing={isDealing} />
          </motion.div>
        </div>

        {/* Winner announcement overlay - smaller and centered */}
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
                  scale: [1, 1.03, 1],
                  boxShadow: ['0 0 12px rgba(251, 191, 36, 0.4)', '0 0 20px rgba(251, 191, 36, 0.6)', '0 0 12px rgba(251, 191, 36, 0.4)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 px-2 py-1 rounded-full shadow-lg"
              >
                <div className="flex items-center gap-0.5">
                  <Star className="h-2 w-2 text-black fill-black" />
                  <span className="text-[10px] font-black text-black tracking-wider">RESULTS</span>
                  <Star className="h-2 w-2 text-black fill-black" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Banker at top center */}
        <div className="absolute top-[1%] left-1/2 -translate-x-1/2 z-10">
          {banker ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative overflow-visible bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur rounded-lg p-0.5 border-2 transition-all min-w-[80px] max-w-[95px]",
                isBankerTurn 
                  ? 'border-yellow-400 shadow-md shadow-yellow-500/30' 
                  : bankerIsWinner
                    ? 'border-green-400 shadow-md shadow-green-500/30'
                    : isGameFinished && banker.result === 'lose'
                      ? 'border-red-400/50'
                      : 'border-amber-600/40'
              )}
              data-banker-seat="true"
            >
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-10 h-10 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-lg" />
              
              {/* Banker decision indicator */}
              <AnimatePresence>
                {showBankerDecision && bankerDecision && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: -10 }}
                    className="absolute -top-5 left-1/2 -translate-x-1/2 z-40"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: 2, duration: 0.3 }}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[8px] font-bold uppercase whitespace-nowrap shadow-lg',
                        bankerDecision === 'hirit' 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white' 
                          : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black'
                      )}
                    >
                      {bankerDecision === 'hirit' ? '🎴 Hirit!' : '✋ Good!'}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="relative flex flex-col items-center gap-0.5">
                {/* Avatar and info */}
                <div className="flex items-center gap-0.5">
                  <div className="relative flex-shrink-0">
                    <Lucky9PlayerAvatar
                      username={banker.username}
                      isBanker
                      isMe={isCurrentUserBanker}
                      size="xs"
                      currentEmoji={playerEmojis[banker.userId] || null}
                    />
                    <motion.div 
                      className="absolute -top-0.5 -right-0.5"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Crown className="h-2 w-2 text-amber-400 fill-amber-400" />
                    </motion.div>
                  </div>
                  <div className="min-w-0 text-center">
                    <div className="flex items-center gap-0.5 justify-center flex-wrap">
                      <span className="font-bold text-amber-400 text-[6px] truncate max-w-[30px]">{banker.username}</span>
                      {isCurrentUserBanker && (
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-[6px] px-1 py-0 font-bold shadow-lg shadow-purple-500/30">
                            🎰 BANKER (YOU)
                          </Badge>
                        </motion.div>
                      )}
                    </div>
                    <span className="text-yellow-400 font-mono text-[6px] font-bold">₱{banker.stack.toLocaleString()}</span>
                  </div>
                </div>


                {/* Banker Cards - allow overflow for 3 cards */}
                {bankerCards.length > 0 && (
                  <div className="flex gap-0.5 items-center justify-center overflow-visible -mx-1">
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
                          extraSmall
                          onReveal={() => onCardReveal?.(banker?.id || '', i)}
                        />
                      );
                    })}
                    {(showAllCards || isCurrentUserBanker) && bankerValue !== null && (
                      <div className="ml-0.5 text-center">
                        {bankerIsNatural && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          >
                            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[5px] flex items-center gap-0.5 shadow-lg px-0.5">
                              <Sparkles className="h-1.5 w-1.5" />
                              9!
                            </Badge>
                          </motion.div>
                        )}
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`text-sm font-bold ${bankerValue === 9 ? 'text-amber-400' : 'text-white'}`}
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
                    className="text-center"
                  >
                    <Badge className={`text-[6px] font-bold ${
                      banker.result === 'win' || banker.result === 'natural_win' ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 
                      banker.result === 'lose' ? 'bg-gradient-to-r from-red-500 to-red-400' : 
                      'bg-slate-500'
                    }`}>
                      {banker.result === 'win' || banker.result === 'natural_win' ? '🏆' : banker.result === 'lose' ? '💔' : '↔'}
                    </Badge>
                    {banker.winnings !== 0 && (
                      <motion.div 
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className={`text-[8px] font-bold ${banker.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {banker.winnings > 0 ? '+' : ''}₱{banker.winnings.toLocaleString()}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Winner indicator */}
                <AnimatePresence>
                  {bankerIsWinner && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                    >
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className={cn(
                          'px-1.5 py-0.5 rounded-full text-[6px] font-bold shadow-lg whitespace-nowrap',
                          bankerIsNatural
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black'
                            : 'bg-gradient-to-r from-green-500 to-emerald-400 text-white'
                        )}
                      >
                        {bankerIsNatural ? '🏆9!' : '🎉WIN'}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

        {/* Player Seats - positioned around the table */}
        {seats.map((player, displayPosition) => {
          if (!player) {
            // Empty seat
            return (
              <div 
                key={`empty-${displayPosition}`} 
                className={cn('absolute z-10', seatPositionStyles[displayPosition])}
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-800/30 border-2 border-dashed border-slate-600/30 flex items-center justify-center">
                  <span className="text-slate-600 text-[8px]">{displayPosition + 1}</span>
                </div>
              </div>
            );
          }

          const isCurrentTurn = game?.status === 'player_turns' && game.currentPlayerPosition === player.position;
          const isMe = player.userId === currentUserId;
          const shouldShowCards = isMe || showAllCards;
          const playerIsWinner = isGameFinished && (player.result === 'win' || player.result === 'natural_win');
          
          return (
            <div 
              key={player.id}
              className={cn('absolute z-10', seatPositionStyles[displayPosition])}
              data-player-seat={player.id}
              data-player-user-id={player.userId}
            >
              <Lucky9PlayerSeat
                player={player}
                isCurrentTurn={isCurrentTurn}
                showCards={shouldShowCards}
                gameStatus={game?.status || 'betting'}
                isMe={isMe && !isSpectator}
                isBankerView={isBankerView}
                isAdmin={isAdmin}
                onAcceptBet={onAcceptBet}
                onRejectBet={onRejectBet}
                onKickPlayer={onKickPlayer}
                isProcessing={isProcessing}
                canRevealCards={isMe && !isSpectator && isCurrentTurn && !player.hasActed}
                onCardReveal={(cardIndex) => onCardReveal?.(player.id, cardIndex)}
                currentEmoji={playerEmojis[player.userId] || null}
                currentDecision={playerDecisions[player.userId] || null}
                showNaturalBadge={player.isNatural}
                isWinner={playerIsWinner}
                isCompact={!isMe} // Make other players' seats compact
              />
            </div>
          );
        })}

        {/* Empty state when no players */}
        {nonBankerPlayers.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-[15%] left-1/2 -translate-x-1/2 text-center z-10"
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
