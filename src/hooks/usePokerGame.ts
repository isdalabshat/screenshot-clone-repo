import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Player, Game, ActionType, PokerTable, Card } from '@/types/poker';
import { stringToCard } from '@/lib/poker/deck';
import { useToast } from './use-toast';
import { SidePot } from '@/components/poker/SidePotDisplay';

// Calculate side pots based on player bets
function calculateSidePots(players: Player[]): SidePot[] {
  const activePlayers = players.filter(p => !p.isFolded);
  if (activePlayers.length === 0) return [];

  const allInPlayers = activePlayers.filter(p => p.isAllIn);
  if (allInPlayers.length === 0) {
    // No side pots needed - single main pot
    const totalBets = activePlayers.reduce((sum, p) => sum + p.currentBet, 0);
    if (totalBets > 0) {
      return [{ amount: totalBets, eligibleCount: activePlayers.length, label: 'Main' }];
    }
    return [];
  }

  // Get unique all-in amounts
  const allInAmounts = [...new Set(allInPlayers.map(p => p.currentBet))].sort((a, b) => a - b);
  
  const sidePots: SidePot[] = [];
  let previousLevel = 0;

  for (let i = 0; i < allInAmounts.length; i++) {
    const allInAmount = allInAmounts[i];
    const eligiblePlayers = activePlayers.filter(p => p.currentBet >= allInAmount);
    const contributionLevel = allInAmount - previousLevel;
    const potAmount = activePlayers
      .filter(p => p.currentBet > previousLevel)
      .reduce((sum, p) => sum + Math.min(contributionLevel, p.currentBet - previousLevel), 0);

    if (potAmount > 0) {
      sidePots.push({
        amount: potAmount,
        eligibleCount: eligiblePlayers.length,
        label: i === 0 ? 'Main' : `Side ${i}`
      });
    }
    previousLevel = allInAmount;
  }

  // Remaining amounts above highest all-in
  const maxAllIn = Math.max(...allInAmounts);
  const remainingPlayers = activePlayers.filter(p => p.currentBet > maxAllIn);
  if (remainingPlayers.length > 0) {
    const remainingAmount = remainingPlayers.reduce((sum, p) => sum + (p.currentBet - maxAllIn), 0);
    if (remainingAmount > 0) {
      sidePots.push({
        amount: remainingAmount,
        eligibleCount: remainingPlayers.length,
        label: `Side ${sidePots.length}`
      });
    }
  }

  return sidePots;
}

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
  const [isActionPending, setIsActionPending] = useState(false);
  const [sidePots, setSidePots] = useState<SidePot[]>([]);

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
    // Calculate side pots whenever players change
    setSidePots(calculateSidePots(players));
  }, [players]);

  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const currentPlayer = players.find(p => p.userId === user?.id);
  const isCurrentPlayerTurn = game?.currentPlayerPosition === currentPlayer?.position && !isActionPending;

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

      if (remaining === 0 && isCurrentPlayerTurn) {
        handleAutoFold();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [game?.turnExpiresAt, game?.status, isCurrentPlayerTurn]);

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

      const isMe = p.user_id === currentUserId;
      const hasCards = p.hole_cards && p.hole_cards.length > 0;

      return {
        id: p.id,
        userId: p.user_id,
        username: profilesMap.get(p.user_id) || 'Unknown',
        position: p.position,
        stack: p.stack,
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

      if (error.code === '23505') {
        console.log(`Position ${availablePosition} taken, retrying...`);
        continue;
      }

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

  const leaveTable = async () => {
    if (!currentPlayer) return;

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

      // Optimistic update for turn indicator
      if (data?.currentPlayerPosition !== undefined) {
        setGame(prev => prev ? { ...prev, currentPlayerPosition: data.currentPlayerPosition } : prev);
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

  // Perform action with optimistic UI updates
  const performAction = async (action: ActionType, amount?: number) => {
    const currentGame = gameRef.current;
    if (!currentGame || !currentPlayer || !isCurrentPlayerTurn || isActionPending) return;

    // Set pending to prevent double-clicks
    setIsActionPending(true);

    // Optimistic UI update - immediately update local state
    const optimisticUpdates = () => {
      // Find next player position for optimistic update
      const sortedPlayers = [...playersRef.current].sort((a, b) => a.position - b.position);
      const currentIdx = sortedPlayers.findIndex(p => p.position === currentPlayer.position);
      
      let optimisticNextPosition: number | null = null;
      for (let i = 1; i <= sortedPlayers.length; i++) {
        const idx = (currentIdx + i) % sortedPlayers.length;
        const p = sortedPlayers[idx];
        if (!p.isFolded && !p.isAllIn && p.userId !== currentPlayer.userId) {
          optimisticNextPosition = p.position;
          break;
        }
      }

      // Calculate optimistic player state changes
      let optimisticStack = currentPlayer.stack;
      let optimisticBet = currentPlayer.currentBet;
      let optimisticPot = currentGame.pot;
      let optimisticIsFolded = false;
      let optimisticIsAllIn = false;

      switch (action) {
        case 'fold':
          optimisticIsFolded = true;
          break;
        case 'check':
          // No change
          break;
        case 'call': {
          const callAmount = Math.min(currentGame.currentBet - currentPlayer.currentBet, currentPlayer.stack);
          optimisticStack -= callAmount;
          optimisticBet += callAmount;
          optimisticPot += callAmount;
          if (optimisticStack === 0) optimisticIsAllIn = true;
          break;
        }
        case 'bet':
        case 'raise': {
          const betAmount = amount || currentGame.currentBet * 2;
          const totalBet = betAmount - currentPlayer.currentBet;
          optimisticStack -= totalBet;
          optimisticBet = betAmount;
          optimisticPot += totalBet;
          if (optimisticStack === 0) optimisticIsAllIn = true;
          break;
        }
        case 'all_in':
          optimisticPot += optimisticStack;
          optimisticBet += optimisticStack;
          optimisticStack = 0;
          optimisticIsAllIn = true;
          break;
      }

      // Update game state optimistically
      setGame(prev => prev ? {
        ...prev,
        pot: optimisticPot,
        currentPlayerPosition: optimisticNextPosition,
        currentBet: action === 'bet' || action === 'raise' || action === 'all_in' 
          ? Math.max(prev.currentBet, optimisticBet) 
          : prev.currentBet
      } : prev);

      // Update player state optimistically
      setPlayers(prev => prev.map(p => 
        p.userId === currentPlayer.userId
          ? {
              ...p,
              stack: optimisticStack,
              currentBet: optimisticBet,
              isFolded: optimisticIsFolded,
              isAllIn: optimisticIsAllIn,
              isCurrentPlayer: false
            }
          : {
              ...p,
              isCurrentPlayer: p.position === optimisticNextPosition
            }
      ));
    };

    // Apply optimistic updates
    optimisticUpdates();

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) {
        // Revert optimistic update on auth error
        await fetchGame();
        await fetchPlayers();
        setIsActionPending(false);
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
        // Revert optimistic update on error
        await fetchGame();
        await fetchPlayers();
        
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
        setIsActionPending(false);
        return;
      }

      // Update with server response for accurate turn indicator
      if (data?.nextPlayerPosition !== undefined) {
        setGame(prev => prev ? { ...prev, currentPlayerPosition: data.nextPlayerPosition } : prev);
        setPlayers(prev => prev.map(p => ({
          ...p,
          isCurrentPlayer: p.position === data.nextPlayerPosition
        })));
      }

      // Clear pending after successful response
      setIsActionPending(false);
      
    } catch (err: any) {
      console.error('Action exception:', err);
      // Revert optimistic update on exception
      await fetchGame();
      await fetchPlayers();
      setIsActionPending(false);
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
      await Promise.all([fetchGame(), fetchPlayers(), fetchMyCards()]);
      setIsLoading(false);
    };
    init();
  }, [fetchTable, fetchGame, fetchPlayers, fetchMyCards]);

  // Realtime subscriptions - INSTANT sync for all users
  useEffect(() => {
    // Track if we're the one who triggered the update
    const myUserIdRef = userIdRef.current;
    
    // Instant update handler - no debounce for real-time poker
    const handleInstantUpdate = async (payload: any) => {
      // Don't refetch if this user's action is pending (optimistic update handles it)
      // But ALWAYS update for OTHER users' actions
      const isMyAction = payload?.new?.user_id === myUserIdRef;
      if (isActionPending && isMyAction) return;
      
      // Immediate parallel fetch for instant sync
      await Promise.all([fetchGame(), fetchPlayers(), fetchMyCards()]);
    };

    const handleGameUpdate = async (payload: any) => {
      // Game updates (pot, community cards, current player) - always instant
      await Promise.all([fetchGame(), fetchPlayers(), fetchMyCards()]);
    };
    
    const channel = supabase
      .channel(`table-realtime-${tableId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games', 
        filter: `table_id=eq.${tableId}` 
      }, handleGameUpdate)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'table_players', 
        filter: `table_id=eq.${tableId}` 
      }, handleInstantUpdate)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'poker_tables', 
        filter: `id=eq.${tableId}` 
      }, fetchTable)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, fetchGame, fetchPlayers, fetchTable, fetchMyCards, isActionPending]);

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
    isActionPending,
    sidePots,
    joinTable,
    leaveTable,
    startHand,
    performAction
  };
}
