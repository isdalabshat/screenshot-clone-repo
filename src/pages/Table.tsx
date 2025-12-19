import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePokerGame } from '@/hooks/usePokerGame';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import PokerTableComponent from '@/components/poker/PokerTable';
import ActionButtons from '@/components/poker/ActionButtons';
import TableChat from '@/components/poker/TableChat';
import WinnerAnimation from '@/components/poker/WinnerAnimation';
import AutoStartCountdown from '@/components/poker/AutoStartCountdown';
import EmojiReactions from '@/components/poker/EmojiReactions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Play, LogOut, Coins, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
    joinTable, 
    leaveTable, 
    startHand,
    performAction
  } = usePokerGame(tableId!);

  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showWinner, setShowWinner] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; amount: number; id: string } | null>(null);
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
    
    // Start 2-second countdown
    setAutoStartCountdown(2);
    
    countdownIntervalRef.current = setInterval(() => {
      setAutoStartCountdown(prev => {
        if (prev === null || prev <= 1) {
          return prev;
        }
        return prev - 1;
      });
    }, 1000);
    
    // After 2 seconds, start the hand
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
    }, 2000);
  }, [clearAutoStartTimers, soundEnabled, playSound, startHand]);

  // Sound effects based on game state changes
  useEffect(() => {
    if (!game) return;

    // Card deal sound when cards are dealt
    if (soundEnabled && myCards.length > 0 && prevMyCardsLength.current === 0) {
      playDealSequence(2, 200);
    }
    prevMyCardsLength.current = myCards.length;

    // New round sound
    if (prevGameStatus.current !== game.status) {
      if (soundEnabled && ['flop', 'turn', 'river'].includes(game.status)) {
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
  }, [game?.status, game?.pot, players, soundEnabled, playSound, playDealSequence, user?.id, myCards.length]);

  // Winner detection - separate effect for reliability
  useEffect(() => {
    if (!game) return;
    
    const isGameEnded = game.status === 'showdown' || game.status === 'complete';
    
    // Only detect winner once per game
    if (isGameEnded && lastWinnerGameId.current !== game.id) {
      // Find winner - the non-folded player(s)
      if (prevPot.current > 0 && players.length > 0) {
        const nonFolded = players.filter(p => !p.isFolded);
        
        let winnerId = '';
        let winnerName = '';
        let winAmount = prevPot.current;
        
        if (nonFolded.length === 1) {
          // Single winner (everyone else folded)
          winnerId = nonFolded[0].userId;
          winnerName = nonFolded[0].username;
        } else if (nonFolded.length > 0) {
          // Multiple players at showdown - find who gained the most
          let maxGain = 0;
          for (const player of nonFolded) {
            const prevStack = prevPlayerStacks.current.get(player.userId) || 0;
            const gain = player.stack - prevStack;
            if (gain > maxGain) {
              maxGain = gain;
              winnerId = player.userId;
              winnerName = player.username;
              winAmount = gain;
            }
          }
        }
        
        // Show winner animation
        if (winnerId && winnerName) {
          lastWinnerGameId.current = game.id;
          setWinnerInfo({ name: winnerName, amount: winAmount, id: winnerId });
          setShowWinner(true);
          if (soundEnabled) playSound('win');
          
          // Hide winner after 3 seconds
          setTimeout(() => {
            setShowWinner(false);
            setWinnerInfo(null);
          }, 3000);
        }
      }
    }
  }, [game?.id, game?.status, players, soundEnabled, playSound]);

  // Track player stacks for winner detection
  useEffect(() => {
    if (game?.status === 'preflop' || !game) {
      // At the start of a hand, record current stacks
      const stackMap = new Map<string, number>();
      players.forEach(p => stackMap.set(p.userId, p.stack));
      prevPlayerStacks.current = stackMap;
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
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={leaveTable}>
                <LogOut className="h-3 w-3 mr-1" />
                Leave
              </Button>
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
            winnerId={winnerInfo?.id}
            sidePots={sidePots}
            playerEmojis={playerEmojis}
          />
        )}
      </main>

      {/* Winner Animation */}
      <WinnerAnimation
        winnerName={winnerInfo?.name}
        amount={winnerInfo?.amount}
        isVisible={showWinner}
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
              
              {/* Manual start button - only show if no countdown is active and game can start */}
              {canStartHand && autoStartCountdown === null && !isWaitingForPlayers && !showWinner && (
                <Button 
                  size="sm" 
                  className="bg-primary hover:bg-primary/90 w-full transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isStartingHand.current}
                  onClick={() => {
                    if (isStartingHand.current) return;
                    isStartingHand.current = true;
                    clearAutoStartTimers();
                    if (soundEnabled) playSound('shuffle');
                    startHand();
                    setTimeout(() => { isStartingHand.current = false; }, 1500);
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Now
                </Button>
              )}
            </>
          )}

          {!isJoined && !tableEnded && (
            <p className="text-muted-foreground text-xs text-center">Join the table to play!</p>
          )}

          {game?.status === 'showdown' && !showWinner && (
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