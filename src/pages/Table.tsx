import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePokerGame } from '@/hooks/usePokerGame';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import PokerTableComponent from '@/components/poker/PokerTable';
import ActionButtons from '@/components/poker/ActionButtons';
import TableChat from '@/components/poker/TableChat';
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
    joinTable, 
    leaveTable, 
    startHand,
    performAction
  } = usePokerGame(tableId!);

  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const prevGameStatus = useRef<string | null>(null);
  const prevCurrentPlayer = useRef<string | null>(null);
  const prevMyCardsLength = useRef<number>(0);

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

    // Card deal sound when cards are dealt
    if (myCards.length > 0 && prevMyCardsLength.current === 0) {
      playDealSequence(2, 200);
    }
    prevMyCardsLength.current = myCards.length;

    // New round sound
    if (prevGameStatus.current !== game.status) {
      if (['flop', 'turn', 'river'].includes(game.status)) {
        playSound('cardFlip');
        if (game.status === 'flop') {
          playDealSequence(3, 150);
        } else {
          playSound('deal');
        }
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
  }, [game?.status, players, soundEnabled, playSound, playDealSequence, user?.id, myCards.length]);

  // Auto leave when balance is 0
  const hasLeftForZeroChips = useRef(false);
  
  useEffect(() => {
    if (currentPlayer && currentPlayer.stack === 0 && (!game || game.status === 'complete' || game.status === 'showdown')) {
      if (!hasLeftForZeroChips.current) {
        hasLeftForZeroChips.current = true;
        toast({
          title: 'Out of chips!',
          description: 'Your stack is empty. Returning to lobby.',
          variant: 'destructive'
        });
        leaveTable();
        navigate('/lobby');
      }
    } else if (currentPlayer && currentPlayer.stack > 0) {
      hasLeftForZeroChips.current = false;
    }
  }, [currentPlayer?.stack, game?.status, leaveTable, toast, navigate]);

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
          />
        )}
      </main>

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
              onAction={handleAction}
            />
          )}

          {/* Start Hand Button */}
          {canStartHand && !tableEnded && (
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90 w-full transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => {
                if (soundEnabled) playSound('shuffle');
                startHand();
              }}
            >
              <Play className="h-4 w-4 mr-2" />
              {game?.status === 'showdown' || game?.status === 'complete' ? 'Deal Next Hand' : 'Start Hand'}
            </Button>
          )}

          {/* Status messages */}
          {isJoined && players.length < 2 && (
            <p className="text-muted-foreground text-xs text-center">Waiting for more players...</p>
          )}

          {!isJoined && !tableEnded && (
            <p className="text-muted-foreground text-xs text-center">Join the table to play!</p>
          )}

          {game?.status === 'showdown' && (
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