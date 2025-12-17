import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Player, Game, Card, ActionType, PokerTable } from '@/types/poker';
import { createDeck, shuffleDeck, cardToString, stringToCard } from '@/lib/poker/deck';
import { useToast } from './use-toast';

export function usePokerGame(tableId: string) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [table, setTable] = useState<PokerTable | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  const currentPlayer = players.find(p => p.userId === user?.id);
  const isCurrentPlayerTurn = game?.currentPlayerPosition === currentPlayer?.position;

  // Fetch table data
  const fetchTable = useCallback(async () => {
    const { data } = await supabase
      .from('poker_tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle();

    if (data) {
      setTable({
        id: data.id,
        name: data.name,
        smallBlind: data.small_blind,
        bigBlind: data.big_blind,
        maxPlayers: data.max_players,
        handsPlayed: data.hands_played,
        maxHands: data.max_hands,
        isActive: data.is_active
      });
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
      setGame({
        id: data.id,
        tableId: data.table_id,
        status: data.status as Game['status'],
        pot: data.pot,
        communityCards: (data.community_cards || []).map((c: string) => stringToCard(c)),
        currentBet: data.current_bet,
        dealerPosition: data.dealer_position,
        currentPlayerPosition: data.current_player_position
      });
    } else {
      setGame(null);
    }
  }, [tableId]);

  // Fetch players at table - fetch separately without join
  const fetchPlayers = useCallback(async () => {
    // First get table players
    const { data: playersData, error: playersError } = await supabase
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('is_active', true);

    if (playersError || !playersData) {
      console.error('Error fetching players:', playersError);
      return;
    }

    if (playersData.length === 0) {
      setPlayers([]);
      setIsJoined(false);
      return;
    }

    // Then get profiles for those players
    const userIds = playersData.map(p => p.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, username')
      .in('user_id', userIds);

    const profilesMap = new Map(
      (profilesData || []).map(p => [p.user_id, p.username])
    );

    const playerList: Player[] = playersData.map((p) => ({
      id: p.id,
      userId: p.user_id,
      username: profilesMap.get(p.user_id) || 'Unknown',
      position: p.position,
      stack: p.stack,
      holeCards: (p.hole_cards || []).map((c: string) => stringToCard(c)),
      currentBet: p.current_bet,
      isFolded: p.is_folded,
      isAllIn: p.is_all_in,
      isActive: p.is_active,
      isDealer: game?.dealerPosition === p.position,
      isSmallBlind: game && playersData.length > 1 && ((game.dealerPosition + 1) % playersData.length) === p.position,
      isBigBlind: game && playersData.length > 1 && ((game.dealerPosition + 2) % playersData.length) === p.position,
      isCurrentPlayer: game?.currentPlayerPosition === p.position
    }));
    
    setPlayers(playerList);
    setIsJoined(playerList.some(p => p.userId === user?.id));
  }, [tableId, game, user?.id]);

  // Join table
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

    // Fetch current players directly from DB to get accurate positions
    const { data: currentPlayers } = await supabase
      .from('table_players')
      .select('position, user_id')
      .eq('table_id', tableId)
      .eq('is_active', true);

    // Check if user is already at the table
    if (currentPlayers?.some(p => p.user_id === user.id)) {
      toast({
        title: 'Already joined',
        description: 'You are already at this table.',
        variant: 'destructive'
      });
      await fetchPlayers();
      return;
    }

    // Find first available position
    const takenPositions = (currentPlayers || []).map(p => p.position);
    const availablePosition = Array.from({ length: 9 }, (_, i) => i)
      .find(pos => !takenPositions.includes(pos));

    if (availablePosition === undefined) {
      toast({
        title: 'Table full',
        description: 'This table is full.',
        variant: 'destructive'
      });
      return;
    }

    // Add player to table first
    const { error } = await supabase
      .from('table_players')
      .insert({
        table_id: tableId,
        user_id: user.id,
        position: availablePosition,
        stack: buyIn
      });

    if (error) {
      // If duplicate key error, try to find another position
      if (error.code === '23505') {
        toast({
          title: 'Position taken',
          description: 'Someone else took that seat. Please try again.',
          variant: 'destructive'
        });
        await fetchPlayers();
        return;
      }
      toast({
        title: 'Failed to join',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    // Deduct chips from profile only after successful join
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
  };

  // Leave table
  const leaveTable = async () => {
    if (!currentPlayer) return;

    // Return chips to profile
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
    toast({
      title: 'Left table',
      description: `${currentPlayer.stack} chips returned to your balance.`
    });
  };

  // Start new hand
  const startHand = async () => {
    // Fetch fresh player list
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

    // Sort by position for consistent ordering
    const sortedPlayers = freshPlayers.sort((a, b) => a.position - b.position);

    // Create new game
    const newDealerPosition = game 
      ? sortedPlayers[(sortedPlayers.findIndex(p => p.position === game.dealerPosition) + 1) % sortedPlayers.length].position
      : sortedPlayers[0].position;
    
    const dealerIdx = sortedPlayers.findIndex(p => p.position === newDealerPosition);
    const firstToActIdx = (dealerIdx + 3) % sortedPlayers.length;
    const firstToActPosition = sortedPlayers[firstToActIdx].position;
    
    const { data: newGame, error } = await supabase
      .from('games')
      .insert({
        table_id: tableId,
        status: 'preflop',
        dealer_position: newDealerPosition,
        current_player_position: firstToActPosition
      })
      .select()
      .single();

    if (error || !newGame) {
      toast({
        title: 'Failed to start hand',
        description: error?.message,
        variant: 'destructive'
      });
      return;
    }

    // Deal cards
    const deck = shuffleDeck(createDeck());
    let deckIndex = 0;

    for (const player of sortedPlayers) {
      const holeCards = [
        cardToString(deck[deckIndex++]),
        cardToString(deck[deckIndex++])
      ];
      
      await supabase
        .from('table_players')
        .update({ 
          hole_cards: holeCards,
          current_bet: 0,
          is_folded: false,
          is_all_in: false
        })
        .eq('id', player.id);
    }

    // Post blinds
    const sbIdx = (dealerIdx + 1) % sortedPlayers.length;
    const bbIdx = (dealerIdx + 2) % sortedPlayers.length;
    const sbPlayer = sortedPlayers[sbIdx];
    const bbPlayer = sortedPlayers[bbIdx];

    if (sbPlayer && table) {
      const sbAmount = Math.min(table.smallBlind, sbPlayer.stack);
      await supabase
        .from('table_players')
        .update({ 
          stack: sbPlayer.stack - sbAmount,
          current_bet: sbAmount
        })
        .eq('id', sbPlayer.id);
    }

    if (bbPlayer && table) {
      const bbAmount = Math.min(table.bigBlind, bbPlayer.stack);
      await supabase
        .from('table_players')
        .update({ 
          stack: bbPlayer.stack - bbAmount,
          current_bet: bbAmount
        })
        .eq('id', bbPlayer.id);

      await supabase
        .from('games')
        .update({ 
          pot: table.smallBlind + table.bigBlind,
          current_bet: table.bigBlind
        })
        .eq('id', newGame.id);
    }

    await fetchGame();
    await fetchPlayers();
    toast({
      title: 'New hand started!',
      description: 'Cards have been dealt.'
    });
  };

  // Perform action
  const performAction = async (action: ActionType, amount?: number) => {
    if (!game || !currentPlayer || !isCurrentPlayerTurn) return;

    let newStack = currentPlayer.stack;
    let newBet = currentPlayer.currentBet;
    let newPot = game.pot;
    let isFolded = false;
    let isAllIn = false;

    switch (action) {
      case 'fold':
        isFolded = true;
        break;
      case 'check':
        // No changes needed
        break;
      case 'call':
        const callAmount = Math.min(game.currentBet - currentPlayer.currentBet, currentPlayer.stack);
        newStack -= callAmount;
        newBet += callAmount;
        newPot += callAmount;
        if (newStack === 0) isAllIn = true;
        break;
      case 'bet':
      case 'raise':
        const betAmount = amount || game.currentBet * 2;
        const totalBet = betAmount - currentPlayer.currentBet;
        newStack -= totalBet;
        newBet = betAmount;
        newPot += totalBet;
        if (newStack === 0) isAllIn = true;
        break;
      case 'all_in':
        newPot += newStack;
        newBet += newStack;
        newStack = 0;
        isAllIn = true;
        break;
    }

    // Update player
    await supabase
      .from('table_players')
      .update({
        stack: newStack,
        current_bet: newBet,
        is_folded: isFolded,
        is_all_in: isAllIn
      })
      .eq('id', currentPlayer.id);

    // Record action
    await supabase
      .from('game_actions')
      .insert({
        game_id: game.id,
        user_id: user?.id,
        action_type: action,
        amount: amount || 0,
        round: game.status
      });

    // Find next player
    const activePlayers = players.filter(p => !p.isFolded && p.id !== currentPlayer.id);
    if (activePlayers.length === 0) {
      // Player wins by default
      await supabase
        .from('games')
        .update({ status: 'complete' })
        .eq('id', game.id);
      
      await supabase
        .from('table_players')
        .update({ stack: newStack + newPot })
        .eq('id', currentPlayer.id);

      await fetchGame();
      await fetchPlayers();
      toast({
        title: 'You won!',
        description: `Everyone else folded. You won ${newPot} chips!`
      });
      return;
    }

    // Move to next active player
    const sortedActivePlayers = [...activePlayers].sort((a, b) => a.position - b.position);
    const currentIdx = sortedActivePlayers.findIndex(p => p.position > currentPlayer.position);
    const nextPlayer = currentIdx !== -1 ? sortedActivePlayers[currentIdx] : sortedActivePlayers[0];

    await supabase
      .from('games')
      .update({
        pot: newPot,
        current_bet: Math.max(game.currentBet, newBet),
        current_player_position: nextPlayer.position
      })
      .eq('id', game.id);

    await fetchGame();
    await fetchPlayers();
  };

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchTable();
      await fetchGame();
      await fetchPlayers();
      setIsLoading(false);
    };
    init();
  }, [fetchTable, fetchGame, fetchPlayers]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`table-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `table_id=eq.${tableId}` }, fetchGame)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${tableId}` }, fetchPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_tables', filter: `id=eq.${tableId}` }, fetchTable)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, fetchGame, fetchPlayers, fetchTable]);

  return {
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
  };
}
