import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePokerGame } from '@/hooks/usePokerGame';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import PokerTableComponent from '@/components/poker/PokerTable';
import ActionButtons from '@/components/poker/ActionButtons';
import MyCardsDisplay from '@/components/poker/MyCardsDisplay';
import TableChat from '@/components/poker/TableChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Play, LogOut, Coins, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Table() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { playSound } = useSoundEffects();
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
    joinTable, 
    leaveTable, 
    startHand,
    performAction
  } = usePokerGame(tableId!);

  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoStarting, setAutoStarting] = useState(false);
  
  const prevGameStatus = useRef<string | null>(null);
  const prevCurrentPlayer = useRef<string | null>(null);
  const autoStartTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // Sound effects based on game state changes
  useEffect(() => {
    if (!soundEnabled || !game) return;

    // New round sound
    if (prevGameStatus.current !== game.status) {
      if (['flop', 'turn', 'river'].includes(game.status)) {
        playSound('deal');
      } else if (game.status === 'showdown') {
        playSound('win');
      }
      prevGameStatus.current = game.status;
    }

    // Turn change sound
    const currentTurnPlayer = players.find(p => p.isCurrentPlayer);
    if (currentTurnPlayer && prevCurrentPlayer.current !== currentTurnPlayer.userId) {
      if (currentTurnPlayer.userId === user?.id) {
        playSound('turn');
      }
      prevCurrentPlayer.current = currentTurnPlayer.userId;
    }
  }, [game?.status, players, soundEnabled, playSound, user?.id]);

  // Auto-start hands logic - only one player initiates
  const isStartingRef = useRef(false);
  
  useEffect(() => {
    if (!table || !isJoined || !currentPlayer) return;

    // Only the player at position 0 (or lowest position) triggers auto-start
    const lowestPositionPlayer = players.reduce((lowest, p) => 
      p.position < lowest.position ? p : lowest
    , players[0]);
    
    const shouldTriggerAutoStart = currentPlayer.position === lowestPositionPlayer?.position;
    
    const canAutoStart = 
      players.length >= 2 && 
      (!game || game.status === 'complete' || game.status === 'showdown') &&
      table.handsPlayed < table.maxHands &&
      shouldTriggerAutoStart;

    if (canAutoStart && !autoStarting && !isStartingRef.current) {
      setAutoStarting(true);
      isStartingRef.current = true;
      autoStartTimeout.current = setTimeout(async () => {
        try {
          await startHand();
        } catch (e) {
          console.error('Auto-start failed:', e);
        }
        setAutoStarting(false);
        isStartingRef.current = false;
      }, 3000);
    }

    if (!canAutoStart && autoStarting) {
      setAutoStarting(false);
      isStartingRef.current = false;
      if (autoStartTimeout.current) {
        clearTimeout(autoStartTimeout.current);
      }
    }

    return () => {
      if (autoStartTimeout.current) {
        clearTimeout(autoStartTimeout.current);
      }
    };
  }, [game?.status, players.length, table?.handsPlayed, table?.maxHands, isJoined, autoStarting, startHand, currentPlayer?.position, players]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col">
      {/* Header */}
      <motion.header 
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className="border-b border-emerald-700/30 bg-card/30 backdrop-blur shrink-0"
      >
        <div className="px-2 py-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/lobby')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-emerald-400">{table.name}</h1>
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
              <div className="flex items-center gap-1 bg-emerald-900/50 px-2 py-1 rounded-lg">
                <Coins className="h-3 w-3 text-yellow-400" />
                <span className="font-bold text-yellow-400 text-xs">{currentPlayer.stack.toLocaleString()}</span>
              </div>
            )}
            
            {!isJoined ? (
              <Button 
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
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
            <h2 className="text-2xl font-bold text-emerald-400">Table Complete!</h2>
            <p className="text-muted-foreground">All {table.maxHands} hands have been played.</p>
            <Button onClick={() => navigate('/lobby')} className="bg-emerald-600 hover:bg-emerald-700">
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
          />
        )}
      </main>

      {/* My Cards Display - Fixed at bottom center */}
      <AnimatePresence>
        {isJoined && myCards.length > 0 && !currentPlayer?.isFolded && (
          <MyCardsDisplay
            cards={myCards}
            communityCards={game?.communityCards || []}
            gameStatus={game?.status}
            isFolded={currentPlayer?.isFolded}
          />
        )}
      </AnimatePresence>

      {/* Table Chat */}
      {isJoined && (
        <TableChat
          tableId={tableId!}
          userId={user?.id}
          username={profile?.username}
        />
      )}

      {/* Bottom Action Area */}
      <motion.div 
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className="shrink-0 border-t border-emerald-700/30 bg-slate-900/90 backdrop-blur p-3"
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
              onAction={handleAction}
            />
          )}

          {/* Start Hand Button / Auto-start indicator */}
          {canStartHand && !tableEnded && (
            <div className="flex flex-col items-center gap-1 w-full">
              {autoStarting ? (
                <div className="text-emerald-400 text-sm animate-pulse">
                  Starting next hand...
                </div>
              ) : (
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-700 w-full"
                  onClick={startHand}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {game?.status === 'showdown' || game?.status === 'complete' ? 'Deal Next Hand' : 'Start Hand'}
                </Button>
              )}
            </div>
          )}

          {/* Status messages */}
          {isJoined && players.length < 2 && (
            <p className="text-muted-foreground text-xs text-center">Waiting for more players... (auto-start paused)</p>
          )}

          {!isJoined && !tableEnded && (
            <p className="text-muted-foreground text-xs text-center">Join the table to play!</p>
          )}

          {game?.status === 'showdown' && (
            <motion.p 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-emerald-400 font-bold text-sm"
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
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
