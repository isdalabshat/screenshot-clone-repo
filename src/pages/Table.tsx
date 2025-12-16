import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePokerGame } from '@/hooks/usePokerGame';
import PokerTableComponent from '@/components/poker/PokerTable';
import ActionButtons from '@/components/poker/ActionButtons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Play, LogOut, Coins } from 'lucide-react';

export default function Table() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { 
    table, 
    game, 
    players, 
    currentPlayer,
    isLoading, 
    isJoined,
    isCurrentPlayerTurn,
    joinTable, 
    leaveTable, 
    startHand,
    performAction
  } = usePokerGame(tableId!);

  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(100);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (table) {
      setBuyInAmount(table.bigBlind * 50); // Default buy-in is 50 big blinds
    }
  }, [table]);

  if (isLoading || authLoading || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl">Loading table...</div>
      </div>
    );
  }

  const canStartHand = isJoined && players.length >= 2 && (!game || game.status === 'complete');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-emerald-700/30 bg-card/30 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lobby')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-emerald-400">{table.name}</h1>
              <p className="text-sm text-muted-foreground">
                Blinds: {table.smallBlind}/{table.bigBlind} • Hand {table.handsPlayed}/{table.maxHands}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isJoined && currentPlayer && (
              <div className="flex items-center gap-2 bg-emerald-900/50 px-4 py-2 rounded-lg">
                <Coins className="h-4 w-4 text-yellow-400" />
                <span className="font-bold text-yellow-400">{currentPlayer.stack.toLocaleString()}</span>
              </div>
            )}
            
            {!isJoined ? (
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setShowJoinDialog(true)}
              >
                Join Table
              </Button>
            ) : (
              <Button variant="outline" onClick={leaveTable}>
                <LogOut className="h-4 w-4 mr-2" />
                Leave
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <PokerTableComponent
          players={players}
          communityCards={game?.communityCards || []}
          pot={game?.pot || 0}
          currentUserId={user?.id}
          showdown={game?.status === 'showdown'}
        />

        {/* Game Status */}
        <div className="mt-8 text-center">
          {game && game.status !== 'waiting' && game.status !== 'complete' && (
            <div className="mb-4 px-6 py-2 bg-emerald-900/50 rounded-full text-emerald-400 font-medium">
              {game.status.toUpperCase()}
            </div>
          )}

          {/* Action Buttons */}
          {isJoined && game && game.status !== 'waiting' && game.status !== 'complete' && currentPlayer && (
            <ActionButtons
              currentBet={game.currentBet}
              playerBet={currentPlayer.currentBet}
              playerStack={currentPlayer.stack}
              bigBlind={table.bigBlind}
              canCheck={game.currentBet === currentPlayer.currentBet}
              isCurrentPlayer={isCurrentPlayerTurn}
              onAction={performAction}
            />
          )}

          {/* Start Hand Button */}
          {canStartHand && (
            <Button 
              size="lg" 
              className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8"
              onClick={startHand}
            >
              <Play className="h-5 w-5 mr-2" />
              Start Hand
            </Button>
          )}

          {/* Waiting for players */}
          {isJoined && players.length < 2 && (
            <p className="text-muted-foreground">Waiting for more players to join...</p>
          )}

          {/* Not joined message */}
          {!isJoined && (
            <p className="text-muted-foreground">Join the table to play!</p>
          )}
        </div>
      </main>

      {/* Join Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {table.name}</DialogTitle>
            <DialogDescription>
              Choose your buy-in amount. Minimum: {table.bigBlind * 20}, Maximum: {table.bigBlind * 100}
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
              <span className="text-muted-foreground">chips</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your balance: {profile?.chips.toLocaleString()} chips
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  joinTable(buyInAmount);
                  setShowJoinDialog(false);
                }}
                disabled={buyInAmount < table.bigBlind * 20 || buyInAmount > (profile?.chips || 0)}
              >
                Join with {buyInAmount} chips
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
