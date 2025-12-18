import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Player, Game, ActionType, PokerTable, Card } from '@/types/poker';
import { stringToCard } from '@/lib/poker/deck';
import { useToast } from './use-toast';

export function usePokerGame(tableId: string) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [table, setTable] = useState<PokerTable | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);

  // Use refs to avoid stale closures in realtime callbacks
  const gameRef = useRef<Game | null>(null);
  const playersRef = useRef<Player[]>([]);
  const tableRef = useRef<PokerTable | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);

  // Keep refs in sync
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const currentPlayer = players.find(p => p.userId === user?.id);
  const isCurrentPlayerTurn = game?.currentPlayerPosition === currentPlayer?.position;

  // Turn timer effect
  useEffect(() => {
    if (!game?.turnExpiresAt || game.status === 'complete' || game.status === 'showdown') {
      setTurnTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const expiresAt = new Date(game.turnExpiresAt!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setTurnTimeLeft(remaining);

      // Auto-fold check when timer hits 0 (only for current player)
      if (remaining === 0 && isCurrentPlayerTurn) {
        handleAutoFold();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [game?.turnExpiresAt, game?.status, isCurrentPlayerTurn]);

  // Handle auto-fold when timer expires
  const handleAutoFold = async () => {
    if (!game) return;
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) return;

      await supabase.functions.invoke('poker-game', {
        body: {
          action: 'auto_fold',
          tableId,
          gameId: game.id
        }
      });
    } catch (error) {
      console.error('Auto-fold failed:', error);
    }
  };

  // Fetch table data
  const fetchTable = useCallback(async () => {
    const { data } = await supabase
      .from('poker_tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle();

    if (data) {
      const tableData = {
        id: data.id,
        name: data.name,
        smallBlind: data.small_blind,
        bigBlind: data.big_blind,
        maxPlayers: data.max_players,
        handsPlayed: data.hands_played,
        maxHands: data.max_hands,
        isActive: data.is_active
      };
      setTable(tableData);
      tableRef.current = tableData;
    }
  }, [tableId]);

  // Fetch current game
  const fetchGame = useCallback(async () => {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('table_id', tableId)
      .neq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const newGame: Game = {
        id: data.id,
        tableId: data.table_id,
        status: data.status as Game['status'],
        pot: data.pot,
        communityCards: (data.community_cards || []).map((c: string) => stringToCard(c)),
        currentBet: data.current_bet,
        dealerPosition: data.dealer_position,
        currentPlayerPosition: data.current_player_position,
        turnExpiresAt: data.turn_expires_at
      };
      setGame(newGame);
      gameRef.current = newGame;
    } else {
      setGame(null);
      gameRef.current = null;
      setMyCards([]);
    }
  }, [tableId]);

  // Fetch my cards only (not other players' cards)
  const fetchMyCards = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('table_players')
      .select('hole_cards')
      .eq('table_id', tableId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (data?.hole_cards && data.hole_cards.length > 0) {
      setMyCards(data.hole_cards.map((c: string) => stringToCard(c)));
    } else {
      setMyCards([]);
    }
  }, [tableId, user?.id]);

  // Fetch players at table (without revealing hole cards)
  const fetchPlayers = useCallback(async () => {
    const { data: playersData, error: playersError } = await supabase
      .from('table_players')
      .select('id, user_id, position, stack, current_bet, is_folded, is_all_in, is_active, hole_cards')
      .eq('table_id', tableId)
      .eq('is_active', true);

    if (playersError || !playersData) {
      console.error('Error fetching players:', playersError);
      return;
    }

    if (playersData.length === 0) {
      setPlayers([]);
      playersRef.current = [];
      setIsJoined(false);
      return;
    }

    const userIds = playersData.map(p => p.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, username')
      .in('user_id', userIds);

    const profilesMap = new Map(
      (profilesData || []).map(p => [p.user_id, p.username])
    );

    const currentGame = gameRef.current;
    const currentUserId = userIdRef.current;
    const sortedPlayers = [...playersData].sort((a, b) => a.position - b.position);
    const numPlayers = sortedPlayers.length;

    const playerList: Player[] = sortedPlayers.map((p, idx) => {
      const dealerIdx = sortedPlayers.findIndex(pl => pl.position === currentGame?.dealerPosition);
      
      // Heads-up logic: dealer is SB
      let sbIdx: number, bbIdx: number;
      if (numPlayers === 2 && dealerIdx !== -1) {
        sbIdx = dealerIdx;
        bbIdx = (dealerIdx + 1) % numPlayers;
      } else if (dealerIdx !== -1) {
        sbIdx = (dealerIdx + 1) % numPlayers;
        bbIdx = (dealerIdx + 2) % numPlayers;
      } else {
        sbIdx = -1;
        bbIdx = -1;
      }

      // Only show cards for the current user, not for opponents
      const isMe = p.user_id === currentUserId;
      const hasCards = p.hole_cards && p.hole_cards.length > 0;

      return {
        id: p.id,
        userId: p.user_id,
        username: profilesMap.get(p.user_id) || 'Unknown',
        position: p.position,
        stack: p.stack,
        // Only include actual cards for the current user, empty for opponents
        holeCards: isMe && hasCards ? p.hole_cards.map((c: string) => stringToCard(c)) : [],
        hasHiddenCards: !isMe && hasCards && !p.is_folded,
        currentBet: p.current_bet,
        isFolded: p.is_folded,
        isAllIn: p.is_all_in,
        isActive: p.is_active,
        isDealer: currentGame?.dealerPosition === p.position,
        isSmallBlind: currentGame && numPlayers > 1 && idx === sbIdx,
        isBigBlind: currentGame && numPlayers > 1 && idx === bbIdx,
        isCurrentPlayer: currentGame?.currentPlayerPosition === p.position
      };
    });
    
    setPlayers(playerList);
    playersRef.current = playerList;
    setIsJoined(playerList.some(p => p.userId === currentUserId));
  }, [tableId]);

  // Join table with retry for race conditions
  const joinTable = async (buyIn: number) => {
    if (!user || !profile) return;
    
    if (profile.chips < buyIn) {
      toast({
        title: 'Insufficient chips',
        description: 'You don\'t have enough chips to join this table.',
        variant: 'destructive'
      });
      return;
    }

    // Check if already at this table
    const { data: existingRecord } = await supabase
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingRecord) {
      if (existingRecord.is_active) {
        toast({
          title: 'Already joined',
          description: 'You are already at this table.',
          variant: 'destructive'
        });
        await fetchPlayers();
        return;
      }

      // Reactivate existing seat
      const { error } = await supabase
        .from('table_players')
        .update({
          is_active: true,
          stack: buyIn,
          current_bet: 0,
          is_folded: false,
          is_all_in: false,
          hole_cards: []
        })
        .eq('id', existingRecord.id);

      if (error) {
        toast({
          title: 'Failed to join',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      await supabase
        .from('profiles')
        .update({ chips: profile.chips - buyIn })
        .eq('user_id', user.id);

      await refreshProfile();
      await fetchPlayers();
      toast({
        title: 'Joined table!',
        description: `You've rejoined with ${buyIn} chips.`
      });
      return;
    }

    // Find available position with retry logic
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data: currentPlayers } = await supabase
        .from('table_players')
        .select('position')
        .eq('table_id', tableId)
        .eq('is_active', true);

      const takenPositions = new Set((currentPlayers || []).map(p => p.position));
      const availablePosition = Array.from({ length: 9 }, (_, i) => i)
        .find(pos => !takenPositions.has(pos));

      if (availablePosition === undefined) {
        toast({
          title: 'Table full',
          description: 'This table is full.',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('table_players')
        .insert({
          table_id: tableId,
          user_id: user.id,
          position: availablePosition,
          stack: buyIn
        });

      if (!error) {
        // Success
        await supabase
          .from('profiles')
          .update({ chips: profile.chips - buyIn })
          .eq('user_id', user.id);

        await refreshProfile();
        await fetchPlayers();
        toast({
          title: 'Joined table!',
          description: `You've joined with ${buyIn} chips.`
        });
        return;
      }

      // If duplicate position error, retry with different position
      if (error.code === '23505') {
        console.log(`Position ${availablePosition} taken, retrying...`);
        continue;
      }

      // Other error
      toast({
        title: 'Failed to join',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Failed to join',
      description: 'Could not find an available seat. Please try again.',
      variant: 'destructive'
    });
  };

  // Leave table - auto-fold first if in active game
  const leaveTable = async () => {
    if (!currentPlayer) return;

    // If in an active game and not folded, fold first to prevent bugs
    const currentGame = gameRef.current;
    if (currentGame && 
        currentGame.status !== 'complete' && 
        currentGame.status !== 'showdown' && 
        currentGame.status !== 'waiting' &&
        !currentPlayer.isFolded) {
      try {
        await supabase.functions.invoke('poker-game', {
          body: {
            action: 'perform_action',
            tableId,
            gameId: currentGame.id,
            actionType: 'fold'
          }
        });
      } catch (error) {
        console.error('Auto-fold on leave failed:', error);
      }
    }

    if (profile) {
      await supabase
        .from('profiles')
        .update({ chips: profile.chips + currentPlayer.stack })
        .eq('user_id', user?.id);
    }

    await supabase
      .from('table_players')
      .update({ is_active: false })
      .eq('id', currentPlayer.id);

    await refreshProfile();
    await fetchPlayers();
    setMyCards([]);
    toast({
      title: 'Left table',
      description: `${currentPlayer.stack} chips returned to your balance.`
    });
  };

  // Start new hand via edge function (server-side card dealing)
  const startHand = async () => {
    const { data: freshPlayers } = await supabase
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('is_active', true);

    if (!freshPlayers || freshPlayers.length < 2) {
      toast({
        title: 'Not enough players',
        description: 'Need at least 2 players to start.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('poker-game', {
        body: {
          action: 'start_hand',
          tableId
        }
      });

      if (error) {
        console.error('Start hand error:', error);
        toast({
          title: 'Failed to start hand',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      if (data?.yourCards) {
        setMyCards(data.yourCards.map((c: string) => stringToCard(c)));
      }

      toast({
        title: 'New hand started!',
        description: 'Cards have been dealt.'
      });
    } catch (err) {
      console.error('Start hand exception:', err);
      toast({
        title: 'Failed to start hand',
        description: 'Server error',
        variant: 'destructive'
      });
    }
  };

  // Perform action via edge function (server-side validation)
  const performAction = async (action: ActionType, amount?: number) => {
    const currentGame = gameRef.current;
    if (!currentGame || !currentPlayer || !isCurrentPlayerTurn) return;

    try {
      // Refresh session to ensure we have a valid token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) {
        toast({
          title: 'Session expired',
          description: 'Please refresh the page to continue playing.',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('poker-game', {
        body: {
          action: 'perform_action',
          tableId,
          gameId: currentGame.id,
          actionType: action,
          amount
        }
      });

      if (error) {
        console.error('Action error:', error);
        // Parse error for better messages
        let errorMessage = 'Please try again.';
        if (error.message?.includes('401') || error.message?.includes('session') || error.message?.includes('expired')) {
          errorMessage = 'Session expired. Please refresh the page.';
        } else if (error.message?.includes('turn')) {
          errorMessage = 'Not your turn.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        toast({
          title: 'Action failed',
          description: errorMessage,
          variant: 'destructive'
        });
        return;
      }

      // Realtime subscription will handle the UI update
    } catch (err: any) {
      console.error('Action exception:', err);
      toast({
        title: 'Action failed',
        description: err?.message || 'Server error. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchTable();
      await fetchGame();
      await fetchPlayers();
      await fetchMyCards();
      setIsLoading(false);
    };
    init();
  }, [fetchTable, fetchGame, fetchPlayers, fetchMyCards]);

  // Realtime subscriptions - fetch game first, then players to ensure correct turn indicator
  useEffect(() => {
    let updateDebounce: ReturnType<typeof setTimeout> | null = null;
    let tableDebounce: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 100;
    
    // Unified update function to ensure game state is fetched before players
    const handleGameOrPlayerUpdate = async () => {
      await fetchGame();
      await fetchPlayers();
      await fetchMyCards();
    };
    
    const channel = supabase
      .channel(`table-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `table_id=eq.${tableId}` }, () => {
        if (updateDebounce) clearTimeout(updateDebounce);
        updateDebounce = setTimeout(handleGameOrPlayerUpdate, DEBOUNCE_MS);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${tableId}` }, () => {
        if (updateDebounce) clearTimeout(updateDebounce);
        updateDebounce = setTimeout(handleGameOrPlayerUpdate, DEBOUNCE_MS);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_tables', filter: `id=eq.${tableId}` }, () => {
        if (tableDebounce) clearTimeout(tableDebounce);
        tableDebounce = setTimeout(fetchTable, DEBOUNCE_MS);
      })
      .subscribe();

    return () => {
      if (updateDebounce) clearTimeout(updateDebounce);
      if (tableDebounce) clearTimeout(tableDebounce);
      supabase.removeChannel(channel);
    };
  }, [tableId, fetchGame, fetchPlayers, fetchTable, fetchMyCards]);

  return {
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
  };
}
