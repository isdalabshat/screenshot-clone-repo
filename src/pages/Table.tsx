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

  if (isLoading || authLoading || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl">Loading table...</div>
      </div>
    );
  }

  const canStartHand = isJoined && players.length >= 2 && (!game || game.status === 'complete' || game.status === 'showdown');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex flex-col">
      {/* Header - Mobile optimized */}
      <header className="border-b border-emerald-700/30 bg-card/30 backdrop-blur shrink-0">
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
      </header>

      {/* Game Area - Flex grow to fill space */}
      <main className="flex-1 flex flex-col items-center justify-start p-2 overflow-auto">
        <PokerTableComponent
          players={players}
          communityCards={game?.communityCards || []}
          pot={game?.pot || 0}
          currentUserId={user?.id}
          gameStatus={game?.status}
          myCards={myCards}
          turnTimeLeft={turnTimeLeft}
        />
      </main>

      {/* Bottom Action Area - Fixed at bottom, no overlap */}
      <div className="shrink-0 border-t border-emerald-700/30 bg-slate-900/90 backdrop-blur p-3">
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
              onAction={performAction}
            />
          )}

          {/* Start Hand Button */}
          {canStartHand && (
            <Button 
              size="sm" 
              className="bg-emerald-600 hover:bg-emerald-700 w-full"
              onClick={startHand}
            >
              <Play className="h-4 w-4 mr-2" />
              {game?.status === 'showdown' || game?.status === 'complete' ? 'Deal Next Hand' : 'Start Hand'}
            </Button>
          )}

          {/* Status messages */}
          {isJoined && players.length < 2 && (
            <p className="text-muted-foreground text-xs text-center">Waiting for more players...</p>
          )}

          {!isJoined && (
            <p className="text-muted-foreground text-xs text-center">Join the table to play!</p>
          )}

          {game?.status === 'showdown' && (
            <p className="text-emerald-400 font-bold text-sm">Showdown!</p>
          )}
        </div>
      </div>

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
