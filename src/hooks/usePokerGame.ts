import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Player, Game, ActionType, PokerTable } from '@/types/poker';
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
        currentPlayerPosition: data.current_player_position
      };
      setGame(newGame);
      gameRef.current = newGame;
    } else {
      setGame(null);
      gameRef.current = null;
    }
  }, [tableId]);

  // Fetch players at table
  const fetchPlayers = useCallback(async () => {
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

    const playerList: Player[] = sortedPlayers.map((p, idx) => {
      const dealerIdx = sortedPlayers.findIndex(pl => pl.position === currentGame?.dealerPosition);
      const sbIdx = (dealerIdx + 1) % sortedPlayers.length;
      const bbIdx = (dealerIdx + 2) % sortedPlayers.length;

      return {
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
        isDealer: currentGame?.dealerPosition === p.position,
        isSmallBlind: currentGame && sortedPlayers.length > 1 && idx === sbIdx,
        isBigBlind: currentGame && sortedPlayers.length > 1 && idx === bbIdx,
        isCurrentPlayer: currentGame?.currentPlayerPosition === p.position
      };
    });
    
    setPlayers(playerList);
    playersRef.current = playerList;
    setIsJoined(playerList.some(p => p.userId === currentUserId));
  }, [tableId]);

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

    const { data: currentPlayers } = await supabase
      .from('table_players')
      .select('position')
      .eq('table_id', tableId)
      .eq('is_active', true);

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

    const { error } = await supabase
      .from('table_players')
      .insert({
        table_id: tableId,
        user_id: user.id,
        position: availablePosition,
        stack: buyIn
      });

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
      description: `You've joined with ${buyIn} chips.`
    });
  };

  // Leave table
  const leaveTable = async () => {
    if (!currentPlayer) return;

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

    const sortedPlayers = freshPlayers.sort((a, b) => a.position - b.position);
    const currentGame = gameRef.current;
    const currentTable = tableRef.current;

    if (!currentTable) return;

    // Determine new dealer position
    let newDealerPosition: number;
    if (currentGame) {
      const prevDealerIdx = sortedPlayers.findIndex(p => p.position === currentGame.dealerPosition);
      const nextIdx = prevDealerIdx === -1 ? 0 : (prevDealerIdx + 1) % sortedPlayers.length;
      newDealerPosition = sortedPlayers[nextIdx].position;
    } else {
      newDealerPosition = sortedPlayers[0].position;
    }
    
    const dealerIdx = sortedPlayers.findIndex(p => p.position === newDealerPosition);
    const sbIdx = (dealerIdx + 1) % sortedPlayers.length;
    const bbIdx = (dealerIdx + 2) % sortedPlayers.length;
    
    // First to act preflop is after BB (UTG)
    const firstToActIdx = (bbIdx + 1) % sortedPlayers.length;
    const firstToActPosition = sortedPlayers[firstToActIdx].position;
    
    const { data: newGame, error } = await supabase
      .from('games')
      .insert({
        table_id: tableId,
        status: 'preflop',
        dealer_position: newDealerPosition,
        current_player_position: firstToActPosition,
        current_bet: currentTable.bigBlind,
        pot: 0
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
    const sbPlayer = sortedPlayers[sbIdx];
    const bbPlayer = sortedPlayers[bbIdx];
    let potTotal = 0;

    if (sbPlayer) {
      const sbAmount = Math.min(currentTable.smallBlind, sbPlayer.stack);
      await supabase
        .from('table_players')
        .update({ 
          stack: sbPlayer.stack - sbAmount,
          current_bet: sbAmount,
          is_all_in: sbPlayer.stack <= currentTable.smallBlind
        })
        .eq('id', sbPlayer.id);
      potTotal += sbAmount;
    }

    if (bbPlayer) {
      const bbAmount = Math.min(currentTable.bigBlind, bbPlayer.stack);
      await supabase
        .from('table_players')
        .update({ 
          stack: bbPlayer.stack - bbAmount,
          current_bet: bbAmount,
          is_all_in: bbPlayer.stack <= currentTable.bigBlind
        })
        .eq('id', bbPlayer.id);
      potTotal += bbAmount;
    }

    // Update game with pot
    await supabase
      .from('games')
      .update({ pot: potTotal })
      .eq('id', newGame.id);

    // Store deck for later rounds (community cards)
    // We'll use the remaining deck starting from deckIndex
    const communityDeck = deck.slice(deckIndex, deckIndex + 5);
    const communityCardsStr = communityDeck.map(c => cardToString(c));
    
    // Store community cards in a temporary way (we'll reveal them as rounds progress)
    // For now, store all 5 but mark status as preflop so none show
    await supabase
      .from('games')
      .update({ 
        community_cards: communityCardsStr // Store all 5, but only show based on status
      })
      .eq('id', newGame.id);

    toast({
      title: 'New hand started!',
      description: 'Cards have been dealt.'
    });
  };

  // Check if betting round is complete
  const checkBettingRoundComplete = (currentPlayers: Player[], currentBet: number): boolean => {
    const activePlayers = currentPlayers.filter(p => !p.isFolded && p.isActive);
    
    // If only one player left, round is complete
    if (activePlayers.length <= 1) return true;
    
    // All non-folded, non-all-in players must have matched the current bet
    const playersWhoNeedToAct = activePlayers.filter(p => !p.isAllIn);
    return playersWhoNeedToAct.every(p => p.currentBet === currentBet);
  };

  // Get next round status
  const getNextRound = (currentStatus: Game['status']): Game['status'] => {
    const roundOrder: Game['status'][] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIdx = roundOrder.indexOf(currentStatus);
    return roundOrder[currentIdx + 1] || 'showdown';
  };

  // Get visible community cards count based on round
  const getVisibleCardsCount = (status: Game['status']): number => {
    switch (status) {
      case 'flop': return 3;
      case 'turn': return 4;
      case 'river': return 5;
      case 'showdown': return 5;
      default: return 0;
    }
  };

  // Perform action
  const performAction = async (action: ActionType, amount?: number) => {
    const currentGame = gameRef.current;
    const currentTable = tableRef.current;
    if (!currentGame || !currentPlayer || !isCurrentPlayerTurn || !currentTable) return;

    let newStack = currentPlayer.stack;
    let newBet = currentPlayer.currentBet;
    let newPot = currentGame.pot;
    let newCurrentBet = currentGame.currentBet;
    let isFolded = false;
    let isAllIn = false;

    switch (action) {
      case 'fold':
        isFolded = true;
        break;
      case 'check':
        break;
      case 'call': {
        const callAmount = Math.min(currentGame.currentBet - currentPlayer.currentBet, currentPlayer.stack);
        newStack -= callAmount;
        newBet += callAmount;
        newPot += callAmount;
        if (newStack === 0) isAllIn = true;
        break;
      }
      case 'bet':
      case 'raise': {
        const betAmount = amount || currentGame.currentBet * 2;
        const totalBet = betAmount - currentPlayer.currentBet;
        newStack -= totalBet;
        newBet = betAmount;
        newPot += totalBet;
        newCurrentBet = betAmount;
        if (newStack === 0) isAllIn = true;
        break;
      }
      case 'all_in':
        newPot += newStack;
        newBet += newStack;
        if (newBet > newCurrentBet) newCurrentBet = newBet;
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
        game_id: currentGame.id,
        user_id: user?.id,
        action_type: action,
        amount: amount || 0,
        round: currentGame.status
      });

    // Refresh players to get updated state
    const { data: freshPlayersData } = await supabase
      .from('table_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('is_active', true);

    if (!freshPlayersData) return;

    const freshPlayers: Player[] = freshPlayersData.map(p => ({
      id: p.id,
      userId: p.user_id,
      username: '',
      position: p.position,
      stack: p.stack,
      holeCards: [],
      currentBet: p.current_bet,
      isFolded: p.is_folded,
      isAllIn: p.is_all_in,
      isActive: p.is_active
    }));

    const activePlayers = freshPlayers.filter(p => !p.isFolded);
    
    // Check if only one player left (everyone else folded)
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      await supabase
        .from('games')
        .update({ status: 'complete', pot: 0 })
        .eq('id', currentGame.id);
      
      const winnerData = freshPlayersData.find(p => p.id === winner.id);
      if (winnerData) {
        await supabase
          .from('table_players')
          .update({ stack: winnerData.stack + newPot, current_bet: 0 })
          .eq('id', winner.id);
      }

      toast({
        title: 'Hand complete!',
        description: `Winner takes ${newPot} chips!`
      });
      return;
    }

    // Check if betting round is complete (all active players have matched the bet or are all-in)
    const playersNeedingToAct = activePlayers.filter(p => 
      !p.isAllIn && p.currentBet < newCurrentBet && p.id !== currentPlayer.id
    );

    // Find next player to act
    const sortedActivePlayers = freshPlayers
      .filter(p => !p.isFolded && !p.isAllIn)
      .sort((a, b) => a.position - b.position);

    if (sortedActivePlayers.length === 0 || playersNeedingToAct.length === 0) {
      // Betting round complete - check if all bets are equal
      const allBetsEqual = activePlayers.every(p => 
        p.isFolded || p.isAllIn || p.currentBet === newCurrentBet
      );

      if (allBetsEqual || sortedActivePlayers.length === 0) {
        // Move to next round
        const nextRound = getNextRound(currentGame.status);
        
        // Reset player bets for new round and add to pot
        for (const p of freshPlayersData) {
          if (!p.is_folded) {
            await supabase
              .from('table_players')
              .update({ current_bet: 0 })
              .eq('id', p.id);
          }
        }

        if (nextRound === 'showdown') {
          // Determine winner (simplified - just give to first non-folded player for now)
          const activeAtShowdown = freshPlayersData.filter(p => !p.is_folded);
          if (activeAtShowdown.length > 0) {
            // For simplicity, split pot equally among remaining players
            // TODO: Implement proper hand evaluation
            const winAmount = Math.floor(newPot / activeAtShowdown.length);
            for (const winner of activeAtShowdown) {
              await supabase
                .from('table_players')
                .update({ stack: winner.stack + winAmount })
                .eq('id', winner.id);
            }
          }
          
          await supabase
            .from('games')
            .update({ 
              status: 'showdown',
              pot: 0,
              current_bet: 0,
              current_player_position: null
            })
            .eq('id', currentGame.id);

          toast({
            title: 'Showdown!',
            description: 'The hand is complete.'
          });
        } else {
          // Find first player after dealer for new betting round
          const dealerIdx = sortedActivePlayers.findIndex(p => p.position > currentGame.dealerPosition);
          const firstToActIdx = dealerIdx !== -1 ? dealerIdx : 0;
          const nextPosition = sortedActivePlayers.length > 0 
            ? sortedActivePlayers[firstToActIdx].position 
            : null;

          await supabase
            .from('games')
            .update({ 
              status: nextRound,
              pot: newPot,
              current_bet: 0,
              current_player_position: nextPosition
            })
            .eq('id', currentGame.id);

          toast({
            title: `${nextRound.charAt(0).toUpperCase() + nextRound.slice(1)}!`,
            description: nextRound === 'flop' ? 'The flop is dealt.' : 
                        nextRound === 'turn' ? 'The turn is dealt.' : 
                        'The river is dealt.'
          });
        }
        return;
      }
    }

    // Find next player to act
    const currentIdx = sortedActivePlayers.findIndex(p => p.position > currentPlayer.position);
    const nextPlayer = currentIdx !== -1 ? sortedActivePlayers[currentIdx] : sortedActivePlayers[0];

    await supabase
      .from('games')
      .update({
        pot: newPot,
        current_bet: newCurrentBet,
        current_player_position: nextPlayer?.position ?? null
      })
      .eq('id', currentGame.id);
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
    let gameTimeout: NodeJS.Timeout | null = null;
    let playersTimeout: NodeJS.Timeout | null = null;

    const debouncedFetchGame = () => {
      if (gameTimeout) clearTimeout(gameTimeout);
      gameTimeout = setTimeout(() => {
        fetchGame();
      }, 150);
    };

    const debouncedFetchPlayers = () => {
      if (playersTimeout) clearTimeout(playersTimeout);
      playersTimeout = setTimeout(() => {
        fetchPlayers();
      }, 150);
    };

    const channel = supabase
      .channel(`table-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `table_id=eq.${tableId}` }, debouncedFetchGame)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${tableId}` }, debouncedFetchPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_tables', filter: `id=eq.${tableId}` }, fetchTable)
      .subscribe();

    return () => {
      if (gameTimeout) clearTimeout(gameTimeout);
      if (playersTimeout) clearTimeout(playersTimeout);
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
