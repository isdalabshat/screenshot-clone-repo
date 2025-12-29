import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Coins, Play, Layers } from 'lucide-react';
import { Lucky9Table, Lucky9Game, Lucky9Player } from '@/types/lucky9';
import { Lucky9BetPanel } from '@/components/lucky9/Lucky9BetPanel';
import { Lucky9ActionButtons } from '@/components/lucky9/Lucky9ActionButtons';
import { Lucky9GameStatus } from '@/components/lucky9/Lucky9GameStatus';
import { Lucky9RoleDialog } from '@/components/lucky9/Lucky9RoleDialog';
import { Lucky9BettingTimer } from '@/components/lucky9/Lucky9BettingTimer';
import { Lucky9GamblingTable } from '@/components/lucky9/Lucky9GamblingTable';

export default function Lucky9TablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [table, setTable] = useState<Lucky9Table | null>(null);
  const [game, setGame] = useState<Lucky9Game | null>(null);
  const [players, setPlayers] = useState<Lucky9Player[]>([]);
  const [myPlayer, setMyPlayer] = useState<Lucky9Player | null>(null);
  const [remainingDeck, setRemainingDeck] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [hasBanker, setHasBanker] = useState(false);

  const hasJoined = useRef(false);

  const fetchTable = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from('lucky9_tables')
      .select('*')
      .eq('id', tableId)
      .single();

    if (data) {
      setTable({
        id: data.id,
        name: data.name,
        minBet: data.min_bet,
        maxBet: data.max_bet,
        maxPlayers: data.max_players,
        isActive: data.is_active,
        betTimerSeconds: data.bet_timer_seconds
      });
    }
  }, [tableId]);

  const fetchGame = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from('lucky9_games')
      .select('*')
      .eq('table_id', tableId)
      .in('status', ['betting', 'dealing', 'player_turns', 'banker_turn', 'showdown'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setGame({
        id: data.id,
        tableId: data.table_id,
        status: data.status as Lucky9Game['status'],
        bankerCards: data.dealer_cards || [],
        bankerHiddenCard: data.dealer_hidden_card,
        currentPlayerPosition: data.current_player_position,
        bettingEndsAt: data.betting_ends_at,
        bankerId: data.banker_id
      });
    } else {
      setGame(null);
    }
  }, [tableId]);

  const fetchPlayers = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from('lucky9_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('is_active', true)
      .order('position');

    if (data) {
      const mapped = data.map(p => ({
        id: p.id,
        tableId: p.table_id,
        gameId: p.game_id,
        userId: p.user_id,
        username: p.username,
        position: p.position,
        stack: p.stack,
        currentBet: p.current_bet,
        cards: p.cards || [],
        hasActed: p.has_acted,
        hasStood: p.has_stood,
        isNatural: p.is_natural,
        result: p.result as Lucky9Player['result'],
        winnings: p.winnings,
        isActive: p.is_active,
        isBanker: p.is_banker
      }));
      setPlayers(mapped);
      setHasBanker(mapped.some(p => p.isBanker));
      
      if (user) {
        const me = mapped.find(p => p.userId === user.id);
        setMyPlayer(me || null);
      }
    }
  }, [tableId, user]);

  const checkExistingPlayer = useCallback(async () => {
    if (!user || !tableId) return false;
    
    const { data: existing } = await supabase
      .from('lucky9_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      setMyPlayer({
        id: existing.id,
        tableId: existing.table_id,
        gameId: existing.game_id,
        userId: existing.user_id,
        username: existing.username,
        position: existing.position,
        stack: existing.stack,
        currentBet: existing.current_bet,
        cards: existing.cards || [],
        hasActed: existing.has_acted,
        hasStood: existing.has_stood,
        isNatural: existing.is_natural,
        result: existing.result as Lucky9Player['result'],
        winnings: existing.winnings,
        isActive: existing.is_active,
        isBanker: existing.is_banker
      });
      return true;
    }
    return false;
  }, [user, tableId]);

  const joinTable = async (role: 'banker' | 'player') => {
    if (!user || !tableId) return;
    setIsProcessing(true);
    setShowRoleDialog(false);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'join_table', tableId, userId: user.id, role }
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Joined!', description: `You joined as ${role}` });
      fetchPlayers();
    }
    setIsProcessing(false);
  };

  const leaveTable = async () => {
    if (!myPlayer) return;

    // Handle mid-game leave with proper payouts
    if (game && game.status !== 'finished') {
      const action = myPlayer.isBanker ? 'banker_leave' : 'player_leave';
      await supabase.functions.invoke('lucky9-game', {
        body: { action, playerId: myPlayer.id, gameId: game.id, tableId }
      });
    } else {
      // No active game - just return chips and delete
      if (profile && myPlayer.stack > 0) {
        await supabase
          .from('profiles')
          .update({ chips: profile.chips + myPlayer.stack })
          .eq('user_id', user?.id);
      }
      await supabase.from('lucky9_players').delete().eq('id', myPlayer.id);
    }
    
    navigate('/lucky9');
  };

  const placeBet = async (amount: number) => {
    if (!myPlayer) return;
    setIsProcessing(true);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'place_bet', tableId, playerId: myPlayer.id, betAmount: amount }
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    }
    setIsProcessing(false);
  };

  const startBetting = async () => {
    if (!tableId) return;
    setIsProcessing(true);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'start_betting', tableId }
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    }
    setIsProcessing(false);
  };

  const startRound = async () => {
    if (!game) return;
    setIsProcessing(true);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'start_round', tableId, gameId: game.id }
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    } else if (data?.remainingDeck) {
      setRemainingDeck(data.remainingDeck);
    }
    setIsProcessing(false);
  };

  const handlePlayerAction = async (playerAction: 'draw' | 'stand') => {
    if (!myPlayer || !game) return;
    setIsProcessing(true);

    const action = myPlayer.isBanker ? 'banker_action' : 'player_action';
    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action, playerId: myPlayer.id, gameId: game.id, playerAction, remainingDeck }
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    } else if (data?.remainingDeck) {
      setRemainingDeck(data.remainingDeck);
    }
    setIsProcessing(false);
  };

  const resetRound = async () => {
    if (!tableId) return;
    await supabase.functions.invoke('lucky9-game', { body: { action: 'reset_round', tableId } });
  };

  useEffect(() => {
    fetchTable();
    fetchGame();
    fetchPlayers();
  }, [fetchTable, fetchGame, fetchPlayers]);

  useEffect(() => {
    const initPlayer = async () => {
      if (user && tableId && !hasJoined.current) {
        hasJoined.current = true;
        const exists = await checkExistingPlayer();
        if (!exists) {
          const { data } = await supabase.from('lucky9_players').select('is_banker').eq('table_id', tableId).eq('is_active', true);
          setHasBanker(data?.some(p => p.is_banker) || false);
          setShowRoleDialog(true);
        }
      }
    };
    initPlayer();
  }, [user, tableId, checkExistingPlayer]);

  useEffect(() => {
    if (!tableId) return;
    const channel = supabase
      .channel(`lucky9-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_games', filter: `table_id=eq.${tableId}` }, fetchGame)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_players', filter: `table_id=eq.${tableId}` }, fetchPlayers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tableId, fetchGame, fetchPlayers]);

  useEffect(() => {
    if (game?.status === 'finished') {
      const timeout = setTimeout(resetRound, 5000);
      return () => clearTimeout(timeout);
    }
  }, [game?.status, tableId]);

  const banker = players.find(p => p.isBanker);
  const nonBankerPlayers = players.filter(p => !p.isBanker);
  
  // Game can only proceed if there's a banker
  const hasActiveBanker = !!banker;
  
  // Action conditions - only when there's a banker
  const isMyTurn = hasActiveBanker && game?.status === 'player_turns' && myPlayer && !myPlayer.isBanker && game.currentPlayerPosition === myPlayer.position && !myPlayer.hasActed;
  const isBankerTurn = hasActiveBanker && game?.status === 'banker_turn' && myPlayer?.isBanker && !myPlayer.hasActed;
  const allPlayersHaveBet = nonBankerPlayers.length > 0 && nonBankerPlayers.every(p => p.currentBet > 0);
  
  // Banker can start betting only when there are players and no active game
  const canStartBetting = !game && myPlayer?.isBanker && nonBankerPlayers.length >= 1;
  const canDealCards = game?.status === 'betting' && myPlayer?.isBanker && allPlayersHaveBet;
  
  // Show bet panel only when there's a banker and betting phase
  const showBetPanel = hasActiveBanker && game?.status === 'betting' && myPlayer && !myPlayer.isBanker && myPlayer.currentBet === 0;
  
  // Action buttons only visible when banker exists and it's player's turn
  const showActionButtons = hasActiveBanker && (isMyTurn || isBankerTurn);

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-950 via-slate-900 to-green-950">
        <div className="animate-pulse text-xl text-green-400">Loading table...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-slate-900 to-green-950 pb-24">
      <Lucky9RoleDialog open={showRoleDialog} hasBanker={hasBanker} onSelectRole={joinTable} onCancel={() => navigate('/lucky9')} />

      {/* Compact header for mobile */}
      <header className="border-b border-green-500/30 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="flex justify-between items-center px-3 py-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={leaveTable} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-green-400">{table.name}</h1>
              <p className="text-[10px] text-muted-foreground">₱{table.minBet} - ₱{table.maxBet}</p>
            </div>
          </div>
          {myPlayer && (
            <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-lg border border-yellow-500/30">
              <Coins className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">₱{myPlayer.stack.toLocaleString()}</span>
            </div>
          )}
        </div>
      </header>

      <main className="px-3 py-4 space-y-4">
        {/* Game status */}
        <Lucky9GameStatus 
          status={hasActiveBanker ? (game?.status || 'waiting') : 'waiting_banker'} 
          currentPlayerName={players.find(p => p.position === game?.currentPlayerPosition)?.username}
          bankerName={banker?.username}
          message={!hasActiveBanker ? 'Waiting for a banker to join...' : undefined}
        />

        {/* Betting timer */}
        {hasActiveBanker && game?.bettingEndsAt && game.status === 'betting' && (
          <div className="max-w-xs mx-auto">
            <Lucky9BettingTimer bettingEndsAt={game.bettingEndsAt} />
          </div>
        )}

        {/* Gambling table */}
        <Lucky9GamblingTable players={players} banker={banker || null} game={game} currentUserId={user?.id} />

        {/* Banker controls */}
        {hasActiveBanker && (canStartBetting || canDealCards) && (
          <div className="flex justify-center gap-3 pt-2">
            {canStartBetting && (
              <Button 
                onClick={startBetting} 
                disabled={isProcessing} 
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 px-6 py-5 text-base font-bold rounded-xl shadow-lg shadow-green-500/30"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Betting
              </Button>
            )}
            {canDealCards && (
              <Button 
                onClick={startRound} 
                disabled={isProcessing} 
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-6 py-5 text-base font-bold rounded-xl shadow-lg shadow-amber-500/30"
              >
                <Layers className="h-5 w-5 mr-2" />
                Deal Cards
              </Button>
            )}
          </div>
        )}

        {/* Waiting for banker message for players */}
        {!hasActiveBanker && myPlayer && !myPlayer.isBanker && (
          <div className="text-center py-4">
            <p className="text-amber-400/70 text-sm">Waiting for a banker to start the game...</p>
          </div>
        )}
      </main>

      {/* Fixed bottom panels - only when banker exists */}
      {showBetPanel && (
        <Lucky9BetPanel 
          minBet={table.minBet} 
          maxBet={table.maxBet} 
          playerStack={myPlayer!.stack} 
          onPlaceBet={placeBet} 
          disabled={isProcessing} 
        />
      )}

      {showActionButtons && (
        <Lucky9ActionButtons 
          onDraw={() => handlePlayerAction('draw')} 
          onStand={() => handlePlayerAction('stand')} 
          canDraw={(myPlayer?.cards.length || 0) < 3} 
          disabled={isProcessing} 
        />
      )}
    </div>
  );
}
