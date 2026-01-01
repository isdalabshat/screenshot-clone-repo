import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePokerGame } from '@/hooks/usePokerGame';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { evaluateHand } from '@/lib/poker/handEvaluator';
import { Card, CardSuit, CardRank } from '@/types/poker';
import PokerTableComponent from '@/components/poker/PokerTable';
import ActionButtons from '@/components/poker/ActionButtons';
import TableChat from '@/components/poker/TableChat';
import WinnerAnimation from '@/components/poker/WinnerAnimation';
import AutoStartCountdown from '@/components/poker/AutoStartCountdown';
import EmojiReactions from '@/components/poker/EmojiReactions';
import HandStrengthIndicator from '@/components/poker/HandStrengthIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, LogOut, Coins, Volume2, VolumeX, Coffee, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { CashInOutButtons } from '@/components/CashInOutButtons';

export default function Table() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { playSound, playDealSequence } = useSoundEffects();
  const { 
    table, 
    game, 
    players, 
    myCards,
    currentPlayer,
    isLoading, 
    isJoined,
    isCurrentPlayerTurn,
    turnTimeLeft,
    isActionPending,
    sidePots,
    isPendingStandUp,
    joinTable, 
    leaveTable, 
    standUp,
    startHand,
    performAction,
    toggleSitOut
  } = usePokerGame(tableId!);

  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showWinner, setShowWinner] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ 
    winners: Array<{
      name: string; 
      amount: number; 
      id: string;
      handName?: string;
      winningCards?: string[];
    }>;
    isShowdown: boolean;
    isSplitPot: boolean;
  } | null>(null);
  const [playerEmojis, setPlayerEmojis] = useState<Map<string, string>>(new Map());
  
  // Auto-start countdown state
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const [isWaitingForPlayers, setIsWaitingForPlayers] = useState(false);
  const autoStartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingHand = useRef(false);
  
  const prevGameStatus = useRef<string | null>(null);
  const prevCurrentPlayerId = useRef<string | null>(null);
  const prevMyCardsLength = useRef<number>(0);
  const prevPot = useRef<number>(0);
  const prevPlayerStacks = useRef<Map<string, number>>(new Map());
  const prevFoldedPlayers = useRef<Set<string>>(new Set());
  const lastWinnerGameId = useRef<string | null>(null);

  // Handle player emoji from EmojiReactions
  const handlePlayerEmoji = useCallback((emojiData: { id: string; emoji: string; username: string; userId: string }) => {
    setPlayerEmojis(prev => {
      const newMap = new Map(prev);
      newMap.set(emojiData.userId, emojiData.emoji);
      return newMap;
    });
    
    // Remove emoji after 2.5 seconds
    setTimeout(() => {
      setPlayerEmojis(prev => {
        const newMap = new Map(prev);
        newMap.delete(emojiData.userId);
        return newMap;
      });
    }, 2500);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (table) {
      setBuyInAmount(table.bigBlind * 50);
    }
  }, [table]);

  // Clear all auto-start timers
  const clearAutoStartTimers = useCallback(() => {
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoStartCountdown(null);
  }, []);

  // Start auto-start countdown
  const startAutoStartCountdown = useCallback(() => {
    // Prevent multiple simultaneous starts
    if (isStartingHand.current) return;
    
    clearAutoStartTimers();
    
    // Start 5-second countdown
    setAutoStartCountdown(5);
    
    countdownIntervalRef.current = setInterval(() => {
      setAutoStartCountdown(prev => {
        if (prev === null || prev <= 1) {
          return prev;
        }
        return prev - 1;
      });
    }, 1000);
    
    // After 5 seconds, start the hand
    autoStartTimerRef.current = setTimeout(async () => {
      clearAutoStartTimers();
      
      // Prevent double-start
      if (isStartingHand.current) return;
      isStartingHand.current = true;
      
      if (soundEnabled) playSound('shuffle');
      await startHand();
      
      // Reset after a delay
      setTimeout(() => {
        isStartingHand.current = false;
      }, 1000);
    }, 5000);
  }, [clearAutoStartTimers, soundEnabled, playSound, startHand]);

  // Track if sound has been played for current game phase to prevent duplicates
  const soundPlayedForPhase = useRef<string | null>(null);
  const dealSoundPlayed = useRef(false);
  
  // Sound effects based on game state changes
  useEffect(() => {
    if (!game) {
      // Reset tracking when no game
      soundPlayedForPhase.current = null;
      dealSoundPlayed.current = false;
      prevMyCardsLength.current = 0;
      return;
    }

    // Card deal sound when cards are dealt - only once per hand
    if (soundEnabled && myCards.length > 0 && prevMyCardsLength.current === 0 && !dealSoundPlayed.current) {
      dealSoundPlayed.current = true;
      playDealSequence(2, 200);
    }
    prevMyCardsLength.current = myCards.length;

    // Reset deal sound tracker when game ends
    if (game.status === 'complete' || game.status === 'showdown') {
      dealSoundPlayed.current = false;
    }

    // New round sound - only play once per phase
    const currentPhase = `${game.id}-${game.status}`;
    if (prevGameStatus.current !== game.status && soundPlayedForPhase.current !== currentPhase) {
      if (soundEnabled && ['flop', 'turn', 'river'].includes(game.status)) {
        soundPlayedForPhase.current = currentPhase;
        playSound('cardFlip');
        if (game.status === 'flop') {
          playDealSequence(3, 150);
        } else {
          playSound('deal');
        }
      }
      prevGameStatus.current = game.status;
    }

    // Track pot for winner calculation
    if (game.pot > 0) {
      prevPot.current = game.pot;
    }

    // Turn change sound - only play when turn actually changes
    const currentTurnPlayer = players.find(p => p.isCurrentPlayer);
    const newTurnPlayerId = currentTurnPlayer?.userId || null;
    
    if (newTurnPlayerId && prevCurrentPlayerId.current !== newTurnPlayerId) {
      if (soundEnabled && newTurnPlayerId === user?.id) {
        playSound('turn');
      }
      prevCurrentPlayerId.current = newTurnPlayerId;
    } else if (!newTurnPlayerId) {
      prevCurrentPlayerId.current = null;
    }

    // Fold sound - play when any player folds (for all players to hear)
    const currentFoldedIds = new Set(players.filter(p => p.isFolded).map(p => p.userId));
    const newFolds = [...currentFoldedIds].filter(id => !prevFoldedPlayers.current.has(id));
    
    if (soundEnabled && newFolds.length > 0 && game.status !== 'complete' && game.status !== 'showdown') {
      // Don't play if it was our own fold (already played in handleAction)
      const othersWhoFolded = newFolds.filter(id => id !== user?.id);
      if (othersWhoFolded.length > 0) {
        playSound('fold');
      }
    }
    prevFoldedPlayers.current = currentFoldedIds;
  }, [game?.id, game?.status, game?.pot, players, soundEnabled, playSound, playDealSequence, user?.id, myCards.length]);

  // Helper function to parse card string to Card object
  const parseCardString = useCallback((cardStr: string): Card | null => {
    if (!cardStr || cardStr.length < 2) return null;
    
    const suitMap: Record<string, CardSuit> = {
      'h': 'hearts',
      'd': 'diamonds',
      'c': 'clubs',
      's': 'spades'
    };
    
    const suit = suitMap[cardStr.slice(-1).toLowerCase()];
    const rank = cardStr.slice(0, -1) as CardRank;
    
    if (!suit) return null;
    return { suit, rank };
  }, []);

  // Winner detection - separate effect for reliability with extended showdown delay
  useEffect(() => {
    if (!game) return;
    
    const isGameEnded = game.status === 'showdown' || game.status === 'complete';
    
    // Only detect winner once per game
    if (isGameEnded && lastWinnerGameId.current !== game.id) {
      // Add a longer delay to ensure all player data (including showdown cards) has synced
      const detectWinnerTimeout = setTimeout(() => {
        // Find winner - the non-folded player(s)
        if (prevPot.current > 0 && players.length > 0) {
          const nonFolded = players.filter(p => !p.isFolded);
          
          let isShowdown = false;
          const winnersArray: Array<{
            name: string;
            amount: number;
            id: string;
            handName?: string;
            winningCards?: string[];
            handRank: number;
          }> = [];
          
          if (nonFolded.length === 1) {
            // Single winner (everyone else folded) - no showdown
            const winner = nonFolded[0];
            winnersArray.push({
              id: winner.userId,
              name: winner.username,
              amount: prevPot.current,
              handRank: 0
            });
            isShowdown = false;
          } else if (nonFolded.length > 0) {
            // Multiple players at showdown - evaluate all hands
            isShowdown = true;
            
            // During showdown, all player cards should be visible in the `holeCards` field
            // Evaluate all non-folded players' hands
            const playersWithHands = nonFolded.map(player => {
              let handRank = 0;
              let handName = '';
              let winningCards: string[] = [];
              
              // Use visible hole cards - during showdown these should be populated for all non-folded players
              const playerCards = player.holeCards || [];
              
              if (playerCards.length > 0 && game.communityCards.length >= 5) {
                // All 5 community cards should be available during showdown
                const handResult = evaluateHand(playerCards, game.communityCards);
                handRank = handResult.rank;
                handName = handResult.name;
                winningCards = playerCards.map(c => `${c.rank}${c.suit.charAt(0)}`);
              } else if (playerCards.length > 0 && game.communityCards.length > 0) {
                // Preflop all-in or partial community cards - still evaluate what we have
                const handResult = evaluateHand(playerCards, game.communityCards);
                handRank = handResult.rank;
                handName = handResult.name;
                winningCards = playerCards.map(c => `${c.rank}${c.suit.charAt(0)}`);
              }
              
              const prevStack = prevPlayerStacks.current.get(player.userId) || 0;
              const gain = player.stack - prevStack;
              
              return {
                id: player.userId,
                name: player.username,
                amount: gain > 0 ? gain : 0,
                handRank,
                handName,
                winningCards,
                gain,
                hasCards: playerCards.length > 0
              };
            });
            
            // Find the best hand rank
            const bestHandRank = Math.max(...playersWithHands.map(p => p.handRank));
            
            // Get all players with the best hand (for split pot)
            const bestPlayers = playersWithHands.filter(p => p.handRank === bestHandRank);
            
            // Also include players who gained chips (winners based on stack changes)
            const gainers = playersWithHands.filter(p => p.gain > 0);
            
            console.log('[Winner Detection] Analysis:', {
              nonFolded: nonFolded.length,
              playersWithHands: playersWithHands.map(p => ({
                name: p.name, 
                handName: p.handName, 
                handRank: p.handRank,
                gain: p.gain,
                hasCards: p.hasCards
              })),
              bestHandRank,
              bestPlayers: bestPlayers.map(p => p.name),
              gainers: gainers.map(p => p.name)
            });
            
            // If there are gainers, use them as winners
            if (gainers.length > 0) {
              for (const player of gainers) {
                winnersArray.push({
                  id: player.id,
                  name: player.name,
                  amount: player.amount,
                  handName: player.handName,
                  winningCards: player.winningCards,
                  handRank: player.handRank
                });
              }
            } else if (bestPlayers.length > 0 && bestHandRank > 0) {
              // Use hand evaluation - for all-in scenarios where stacks haven't updated yet
              const splitAmount = Math.floor(prevPot.current / bestPlayers.length);
              for (const player of bestPlayers) {
                winnersArray.push({
                  id: player.id,
                  name: player.name,
                  amount: splitAmount,
                  handName: player.handName,
                  winningCards: player.winningCards,
                  handRank: player.handRank
                });
              }
            }
          }
          
          // Show winner animation with extended delay for showdown
          if (winnersArray.length > 0) {
            lastWinnerGameId.current = game.id;
            
            const isSplitPot = winnersArray.length > 1;
            
            console.log('[Winner Animation] Showing for all players:', {
              winners: winnersArray.map(w => ({ name: w.name, handName: w.handName, amount: w.amount })),
              isShowdown,
              isSplitPot
            });
            
            setWinnerInfo({ 
              winners: winnersArray.map(w => ({
                name: w.name,
                amount: w.amount,
                id: w.id,
                handName: w.handName,
                winningCards: w.winningCards
              })),
              isShowdown,
              isSplitPot
            });
            setShowWinner(true);
            if (soundEnabled) playSound('win');
            
            // Longer delay (5 seconds) if it's a showdown so players can see the cards
            // Shorter delay (3 seconds) if winner by fold
            const delayTime = isShowdown ? 5000 : 3000;
            
            setTimeout(() => {
              setShowWinner(false);
              setWinnerInfo(null);
            }, delayTime);
          }
        }
      }, 500); // Increased delay to ensure showdown data has synced
      
      return () => clearTimeout(detectWinnerTimeout);
    }
  }, [game?.id, game?.status, game?.communityCards, players, soundEnabled, playSound]);

  // Track player stacks for winner detection and reset fold tracking
  useEffect(() => {
    if (game?.status === 'preflop' || !game) {
      // At the start of a hand, record current stacks and reset fold tracking
      const stackMap = new Map<string, number>();
      players.forEach(p => stackMap.set(p.userId, p.stack));
      prevPlayerStacks.current = stackMap;
      prevFoldedPlayers.current = new Set();
    }
  }, [game?.status, players]);

  // Track previous player count for notifications
  const prevPlayerCount = useRef<number>(0);

  // Auto-start game loop - simplified and reliable
  useEffect(() => {
    const activePlayerCount = players.length;
    const gameStatus = game?.status || null;
    const isGameEnded = !game || gameStatus === 'complete' || gameStatus === 'showdown';
    
    console.log('[AutoStart] Checking:', { 
      activePlayerCount, 
      gameStatus, 
      isGameEnded, 
      isJoined, 
      showWinner, 
      isStartingHand: isStartingHand.current,
      autoStartCountdown 
    });
    
    // Handle waiting for players state - less than 2 players
    if (isJoined && activePlayerCount < 2) {
      // Notify if player dropped during countdown
      if (autoStartCountdown !== null && prevPlayerCount.current >= 2) {
        toast({
          title: 'Game Paused',
          description: 'Waiting for another player to join.',
          variant: 'default'
        });
      }
      clearAutoStartTimers();
      setIsWaitingForPlayers(true);
      prevPlayerCount.current = activePlayerCount;
      return;
    }
    
    setIsWaitingForPlayers(false);
    prevPlayerCount.current = activePlayerCount;
    
    // Conditions for auto-start - removed hasAutoStarted flag since it was causing issues
    const canAutoStart = isJoined && 
                         activePlayerCount >= 2 && 
                         isGameEnded &&
                         table && table.handsPlayed < table.maxHands &&
                         !isStartingHand.current &&
                         !showWinner &&
                         autoStartCountdown === null;
    
    console.log('[AutoStart] canAutoStart:', canAutoStart);
    
    if (canAutoStart) {
      // Start countdown after a short delay
      const delayTimer = setTimeout(() => {
        if (!isStartingHand.current && players.length >= 2 && !showWinner) {
          console.log('[AutoStart] Starting countdown');
          startAutoStartCountdown();
        }
      }, 500);
      
      return () => clearTimeout(delayTimer);
    }
  }, [
    players.length, 
    isJoined, 
    game?.status,
    game,
    table?.handsPlayed, 
    table?.maxHands,
    showWinner,
    autoStartCountdown,
    startAutoStartCountdown,
    clearAutoStartTimers,
    toast
  ]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearAutoStartTimers();
    };
  }, [clearAutoStartTimers]);

  // Auto leave when balance is 0 - only after game is settled and confirmed 0 chips
  const hasLeftForZeroChips = useRef(false);
  const zeroChipCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any pending timeout
    if (zeroChipCheckTimeout.current) {
      clearTimeout(zeroChipCheckTimeout.current);
      zeroChipCheckTimeout.current = null;
    }
    
    // Only check after game is complete/showdown AND player has 0 stack
    if (currentPlayer && currentPlayer.stack === 0 && (game?.status === 'complete' || game?.status === 'showdown')) {
      // Wait a bit for winnings to be distributed before checking
      // This prevents the winner from being kicked out due to race conditions
      zeroChipCheckTimeout.current = setTimeout(async () => {
        // Re-check the current player's stack from the database to be sure
        const { data: freshPlayer } = await supabase
          .from('table_players')
          .select('stack')
          .eq('table_id', tableId)
          .eq('user_id', user?.id)
          .eq('is_active', true)
          .maybeSingle();
        
        // Only leave if player truly has 0 chips after winnings are distributed
        if (freshPlayer && freshPlayer.stack === 0 && !hasLeftForZeroChips.current) {
          hasLeftForZeroChips.current = true;
          toast({
            title: 'Out of chips!',
            description: 'Your stack is empty. Returning to lobby.',
            variant: 'destructive'
          });
          leaveTable();
          navigate('/lobby');
        }
      }, 1500); // Wait 1.5s for winnings to be fully distributed
    } else if (currentPlayer && currentPlayer.stack > 0) {
      hasLeftForZeroChips.current = false;
    }
    
    return () => {
      if (zeroChipCheckTimeout.current) {
        clearTimeout(zeroChipCheckTimeout.current);
      }
    };
  }, [currentPlayer?.stack, game?.status, leaveTable, toast, navigate, tableId, user?.id]);

  // Handle action with sound
  const handleAction = (action: any, amount?: number) => {
    if (soundEnabled) {
      if (action === 'fold') playSound('fold');
      else if (action === 'check') playSound('check');
      else if (action === 'all_in') playSound('allIn');
      else playSound('bet');
    }
    performAction(action, amount);
  };

  if (isLoading || authLoading || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="animate-pulse text-xl"
        >
          Loading table...
        </motion.div>
      </div>
    );
  }

  const canStartHand = isJoined && players.length >= 2 && (!game || game.status === 'complete' || game.status === 'showdown');
  const tableEnded = table.handsPlayed >= table.maxHands;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col">
      {/* Header */}
      <motion.header 
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className="border-b border-primary/30 bg-card/30 backdrop-blur shrink-0"
      >
        <div className="px-3 py-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/lobby')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-primary">{table.name}</h1>
              <p className="text-[10px] text-muted-foreground">
                {table.smallBlind}/{table.bigBlind} • Hand {table.handsPlayed}/{table.maxHands}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            {/* Cash In/Out Buttons */}
            {user && profile && <CashInOutButtons userId={user.id} userChips={profile.chips} />}

            {isJoined && currentPlayer && (
              <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg border border-yellow-500/30">
                <Coins className="h-3 w-3 text-yellow-400" />
                <span className="font-bold text-yellow-400 text-xs">{currentPlayer.stack.toLocaleString()}</span>
              </div>
            )}
            
            {!isJoined ? (
              <Button 
                size="sm"
                className="bg-primary hover:bg-primary/90 h-8 text-xs"
                onClick={() => setShowJoinDialog(true)}
                disabled={tableEnded}
              >
                Join
              </Button>
            ) : (
              <>
                <Button 
                  variant={currentPlayer?.isSittingOut ? "default" : "outline"}
                  size="sm" 
                  className={`h-8 text-xs ${currentPlayer?.isSittingOut ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                  onClick={toggleSitOut}
                  disabled={game && game.status !== 'complete' && game.status !== 'showdown' && !currentPlayer?.isFolded}
                  title={currentPlayer?.isSittingOut ? 'Click to sit back in' : 'Click to sit out'}
                >
                  <Coffee className="h-3 w-3 mr-1" />
                  {currentPlayer?.isSittingOut ? 'Sit In' : 'Sit Out'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs" 
                  onClick={leaveTable}
                  disabled={game && game.status !== 'complete' && game.status !== 'showdown'}
                  title={game && game.status !== 'complete' && game.status !== 'showdown' ? 'Cannot leave during active hand' : ''}
                >
                  <LogOut className="h-3 w-3 mr-1" />
                  Leave
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-8 text-xs" 
                  onClick={standUp}
                  disabled={isPendingStandUp}
                  title={isPendingStandUp ? 'Waiting for hand to complete' : 'Stand up and leave table (waits for hand to complete)'}
                >
                  <UserMinus className="h-3 w-3 mr-1" />
                  {isPendingStandUp ? 'Standing Up...' : 'Stand Up'}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Game Area */}
      <main className="flex-1 flex flex-col items-center justify-start p-2 overflow-auto">
        {tableEnded ? (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center h-full gap-4"
          >
            <div className="text-4xl">🏆</div>
            <h2 className="text-2xl font-bold text-primary">Table Complete!</h2>
            <p className="text-muted-foreground">All {table.maxHands} hands have been played.</p>
            <Button onClick={() => navigate('/lobby')} className="bg-primary hover:bg-primary/90">
              Return to Lobby
            </Button>
          </motion.div>
        ) : (
          <PokerTableComponent
            players={players}
            communityCards={game?.communityCards || []}
            pot={game?.pot || 0}
            currentUserId={user?.id}
            gameStatus={game?.status}
            turnTimeLeft={turnTimeLeft}
            handsPlayed={table.handsPlayed}
            maxHands={table.maxHands}
            myCards={myCards}
            winnerId={winnerInfo?.winners?.[0]?.id}
            sidePots={sidePots}
            playerEmojis={playerEmojis}
          />
        )}
      </main>

      {/* Winner Animation */}
      <WinnerAnimation
        winners={winnerInfo?.winners || []}
        isVisible={showWinner}
        isShowdown={winnerInfo?.isShowdown}
        isSplitPot={winnerInfo?.isSplitPot}
      />

      {/* Emoji Reactions - visible to all, but only joined players can send */}
      <EmojiReactions
        tableId={tableId!}
        userId={user?.id}
        username={profile?.username}
        isJoined={isJoined}
        onPlayerEmoji={handlePlayerEmoji}
      />

      {/* Table Chat - only for joined players */}
      {isJoined && (
        <TableChat
          tableId={tableId!}
          userId={user?.id}
          username={profile?.username}
        />
      )}

      {/* Spectator badge */}
      {!isJoined && !tableEnded && user && (
        <div className="fixed bottom-20 left-4 z-30">
          <div className="bg-card/90 backdrop-blur-lg rounded-lg px-3 py-2 border border-primary/30 text-xs text-muted-foreground">
            👁️ Spectating
          </div>
        </div>
      )}

      {/* Bottom Action Area */}
      <motion.div 
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className="shrink-0 border-t border-primary/30 bg-slate-900/95 backdrop-blur p-3"
      >
        <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
          {/* Action Buttons */}
          {isJoined && game && game.status !== 'waiting' && game.status !== 'complete' && game.status !== 'showdown' && currentPlayer && (
            <ActionButtons
              currentBet={game.currentBet}
              playerBet={currentPlayer.currentBet}
              playerStack={currentPlayer.stack}
              bigBlind={table.bigBlind}
              canCheck={game.currentBet === currentPlayer.currentBet}
              isCurrentPlayer={isCurrentPlayerTurn}
              isActionPending={isActionPending}
              onAction={handleAction}
            />
          )}

          {/* Auto-start countdown or manual start */}
          {isJoined && !tableEnded && (
            <>
              {/* Show countdown when auto-starting */}
              <AutoStartCountdown 
                countdown={autoStartCountdown}
                isWaitingForPlayers={isWaitingForPlayers}
                playerCount={players.length}
              />
              
              {/* Game auto-starts - no manual button needed */}
            </>
          )}

          {!isJoined && !tableEnded && (
            <p className="text-muted-foreground text-xs text-center">Join the table to play!</p>
          )}

          {/* Hand Strength Indicator during showdown */}
          {isJoined && currentPlayer && game?.status === 'showdown' && (
            <HandStrengthIndicator
              myCards={myCards}
              communityCards={game.communityCards}
              isShowdown={true}
              isFolded={currentPlayer.isFolded}
            />
          )}

          {game?.status === 'showdown' && !showWinner && !currentPlayer?.isFolded && (
            <motion.p 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-primary font-bold text-sm"
            >
              🎉 Showdown!
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* Join Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join {table.name}</DialogTitle>
            <DialogDescription>
              Choose your buy-in. Min: {table.bigBlind * 20}, Max: {table.bigBlind * 100}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(parseInt(e.target.value) || 0)}
                min={table.bigBlind * 20}
                max={Math.min(table.bigBlind * 100, profile?.chips || 0)}
              />
              <span className="text-muted-foreground text-sm">chips</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your balance: {profile?.chips.toLocaleString()} chips
            </p>
            {(profile?.chips || 0) < table.bigBlind * 20 && (
              <p className="text-sm text-destructive">
                Insufficient balance. Request a cash-in from the lobby.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 flex-1"
                onClick={() => {
                  if (soundEnabled) playSound('chip');
                  joinTable(buyInAmount);
                  setShowJoinDialog(false);
                }}
                disabled={buyInAmount < table.bigBlind * 20 || buyInAmount > (profile?.chips || 0)}
              >
                Join with {buyInAmount}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}