import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { Lucky9Table, Lucky9Game, Lucky9Player } from '@/types/lucky9';
import { Lucky9PlayerSeat } from '@/components/lucky9/Lucky9PlayerSeat';
import { Lucky9Dealer } from '@/components/lucky9/Lucky9Dealer';
import { Lucky9BetPanel } from '@/components/lucky9/Lucky9BetPanel';
import { Lucky9ActionButtons } from '@/components/lucky9/Lucky9ActionButtons';
import { Lucky9GameStatus } from '@/components/lucky9/Lucky9GameStatus';

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

  const hasJoined = useRef(false);

  // Fetch table data
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
        isActive: data.is_active
      });
    }
  }, [tableId]);

  // Fetch current game
  const fetchGame = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from('lucky9_games')
      .select('*')
      .eq('table_id', tableId)
      .in('status', ['betting', 'dealing', 'player_turns', 'dealer_turn', 'showdown'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setGame({
        id: data.id,
        tableId: data.table_id,
        status: data.status as Lucky9Game['status'],
        dealerCards: data.dealer_cards || [],
        dealerHiddenCard: data.dealer_hidden_card,
        currentPlayerPosition: data.current_player_position
      });
    } else {
      setGame(null);
    }
  }, [tableId]);

  // Fetch players
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
        isActive: p.is_active
      }));
      setPlayers(mapped);
      
      if (user) {
        const me = mapped.find(p => p.userId === user.id);
        setMyPlayer(me || null);
      }
    }
  }, [tableId, user]);

  // Join table
  const joinTable = useCallback(async () => {
    if (!user || !profile || !tableId || hasJoined.current) return;
    hasJoined.current = true;

    // Check if already at table
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
        isActive: existing.is_active
      });
      return;
    }

    // Find next available position
    const { data: currentPlayers } = await supabase
      .from('lucky9_players')
      .select('position')
      .eq('table_id', tableId)
      .eq('is_active', true);

    const usedPositions = new Set(currentPlayers?.map(p => p.position) || []);
    let position = 1;
    while (usedPositions.has(position)) position++;

    // Join with chips from profile
    const { data: newPlayer, error } = await supabase
      .from('lucky9_players')
      .insert({
        table_id: tableId,
        user_id: user.id,
        username: profile.username,
        position,
        stack: profile.chips
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      hasJoined.current = false;
    } else if (newPlayer) {
      toast({ title: 'Joined!', description: `You joined the table at position ${position}` });
    }
  }, [user, profile, tableId, toast]);

  // Leave table
  const leaveTable = async () => {
    if (!myPlayer) return;

    // Return chips to profile
    if (profile && myPlayer.stack > 0) {
      await supabase
        .from('profiles')
        .update({ chips: profile.chips + myPlayer.stack })
        .eq('user_id', user?.id);
    }

    await supabase
      .from('lucky9_players')
      .delete()
      .eq('id', myPlayer.id);

    navigate('/lucky9');
  };

  // Place bet
  const placeBet = async (amount: number) => {
    if (!myPlayer) return;
    setIsProcessing(true);

    const { error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'place_bet', tableId, playerId: myPlayer.id, betAmount: amount }
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setIsProcessing(false);
  };

  // Start round (any player can start when all have bet)
  const startRound = async () => {
    if (!tableId) return;
    setIsProcessing(true);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'start_round', tableId }
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data?.remainingDeck) {
      setRemainingDeck(data.remainingDeck);
    }
    setIsProcessing(false);
  };

  // Player action (draw/stand)
  const handlePlayerAction = async (playerAction: 'draw' | 'stand') => {
    if (!myPlayer || !game) return;
    setIsProcessing(true);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { 
        action: 'player_action', 
        playerId: myPlayer.id, 
        gameId: game.id,
        playerAction,
        remainingDeck 
      }
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data?.remainingDeck) {
      setRemainingDeck(data.remainingDeck);
    }
    setIsProcessing(false);
  };

  // Dealer plays
  const dealerPlay = useCallback(async () => {
    if (!game) return;
    setIsProcessing(true);

    const { error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'dealer_play', gameId: game.id, remainingDeck }
    });

    if (error) {
      console.error('Dealer play error:', error);
    }
    setIsProcessing(false);
  }, [game, remainingDeck]);

  // Reset round
  const resetRound = async () => {
    if (!tableId) return;
    
    await supabase.functions.invoke('lucky9-game', {
      body: { action: 'reset_round', tableId }
    });
  };

  // Effects
  useEffect(() => {
    fetchTable();
    fetchGame();
    fetchPlayers();
  }, [fetchTable, fetchGame, fetchPlayers]);

  useEffect(() => {
    if (user && profile && tableId) {
      joinTable();
    }
  }, [user, profile, tableId, joinTable]);

  // Realtime subscriptions
  useEffect(() => {
    if (!tableId) return;

    const channel = supabase
      .channel(`lucky9-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_games', filter: `table_id=eq.${tableId}` }, fetchGame)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_players', filter: `table_id=eq.${tableId}` }, fetchPlayers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, fetchGame, fetchPlayers]);

  // Auto dealer play when it's dealer's turn
  useEffect(() => {
    if (game?.status === 'dealer_turn' && !isProcessing) {
      const timeout = setTimeout(dealerPlay, 1500);
      return () => clearTimeout(timeout);
    }
  }, [game?.status, dealerPlay, isProcessing]);

  // Auto reset after finished
  useEffect(() => {
    if (game?.status === 'finished') {
      const timeout = setTimeout(resetRound, 5000);
      return () => clearTimeout(timeout);
    }
  }, [game?.status, tableId]);

  const isMyTurn = game?.status === 'player_turns' && 
    myPlayer && 
    game.currentPlayerPosition === myPlayer.position &&
    !myPlayer.hasActed;

  const allPlayersHaveBet = players.length > 0 && players.every(p => p.currentBet > 0);
  const canStartRound = !game && allPlayersHaveBet && players.length >= 1;
  const showDealerCards = game && game.dealerCards.length > 0;
  const showAllDealerCards = game?.status === 'showdown' || game?.status === 'finished';

  const currentPlayer = game?.currentPlayerPosition 
    ? players.find(p => p.position === game.currentPlayerPosition)
    : null;

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-xl">Loading table...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-purple-950">
      {/* Header */}
      <header className="border-b border-purple-500/30 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={leaveTable}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-2xl">🎴</span>
            <div>
              <h1 className="text-xl font-bold text-purple-400">{table.name}</h1>
              <p className="text-xs text-muted-foreground">
                Bet: ₱{table.minBet} - ₱{table.maxBet}
              </p>
            </div>
          </div>
          {myPlayer && (
            <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-lg border border-yellow-500/30">
              <Coins className="h-5 w-5 text-yellow-400" />
              <span className="font-bold text-yellow-400">₱{myPlayer.stack.toLocaleString()}</span>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Game Status */}
        <Lucky9GameStatus 
          status={game?.status || 'betting'} 
          currentPlayerName={currentPlayer?.username}
        />

        {/* Dealer Area */}
        {showDealerCards && (
          <div className="flex justify-center">
            <Lucky9Dealer 
              cards={game.dealerCards} 
              hiddenCard={game.dealerHiddenCard}
              showAll={showAllDealerCards}
            />
          </div>
        )}

        {/* Players Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {players.map((player) => (
            <Lucky9PlayerSeat
              key={player.id}
              player={player}
              isCurrentTurn={game?.currentPlayerPosition === player.position}
              showCards={true}
              gameStatus={game?.status || 'betting'}
            />
          ))}
        </div>

        {/* Action Area */}
        <div className="flex justify-center">
          {/* Betting Phase */}
          {!game && myPlayer && myPlayer.currentBet === 0 && (
            <Lucky9BetPanel
              minBet={table.minBet}
              maxBet={table.maxBet}
              playerStack={myPlayer.stack}
              onPlaceBet={placeBet}
              disabled={isProcessing}
            />
          )}

          {/* Waiting for other bets */}
          {!game && myPlayer && myPlayer.currentBet > 0 && !canStartRound && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-4 px-6 bg-slate-800/80 rounded-lg"
            >
              <p className="text-slate-300">Waiting for other players to bet...</p>
              <p className="text-sm text-slate-500 mt-1">Your bet: ₱{myPlayer.currentBet}</p>
            </motion.div>
          )}

          {/* Start Round Button */}
          {canStartRound && (
            <Button
              onClick={startRound}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 px-8 py-6 text-lg"
            >
              🎴 Deal Cards
            </Button>
          )}

          {/* Player Actions */}
          {isMyTurn && (
            <Lucky9ActionButtons
              onDraw={() => handlePlayerAction('draw')}
              onStand={() => handlePlayerAction('stand')}
              canDraw={myPlayer!.cards.length < 3}
              disabled={isProcessing}
            />
          )}
        </div>
      </main>
    </div>
  );
}
