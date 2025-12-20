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
  const [isPendingStandUp, setIsPendingStandUp] = useState(false);

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
  
  // Track when we've taken an action - use a strong lock that only releases when:
  // 1. Turn definitively moves to a different player position (confirmed by server)
  // 2. Game changes completely
  // 3. Game status changes (e.g., preflop -> flop)
  const hasActedThisRound = useRef(false);
  const actedAtPosition = useRef<number | null>(null);
  const actedInGameId = useRef<string | null>(null);
  const actedInGameStatus = useRef<string | null>(null);
  
  // Reset lock when game ID changes (new hand)
  useEffect(() => {
    if (game?.id && game.id !== actedInGameId.current) {
      hasActedThisRound.current = false;
      actedAtPosition.current = null;
      actedInGameId.current = game.id;
      actedInGameStatus.current = game.status;
    }
  }, [game?.id, game?.status]);
  
  // Reset lock when game status/phase changes (new betting round)
  useEffect(() => {
    if (game?.status && game.status !== actedInGameStatus.current && actedInGameId.current === game.id) {
      hasActedThisRound.current = false;
      actedAtPosition.current = null;
      actedInGameStatus.current = game.status;
    }
  }, [game?.status, game?.id]);
  
  // Reset lock when turn definitively moves to a DIFFERENT position (server confirmed)
  useEffect(() => {
    // Only reset if we have acted and turn has moved to a different position
    if (hasActedThisRound.current && 
        actedAtPosition.current !== null && 
        game?.currentPlayerPosition !== null &&
        game?.currentPlayerPosition !== undefined &&
        game.currentPlayerPosition !== actedAtPosition.current) {
      // Turn has moved away from our position - safe to reset
      hasActedThisRound.current = false;
      actedAtPosition.current = null;
    }
  }, [game?.currentPlayerPosition]);
  
  const isCurrentPlayerTurn = !!(
    game?.currentPlayerPosition !== null && 
    game?.currentPlayerPosition !== undefined && 
    currentPlayer?.position !== undefined && 
    game.currentPlayerPosition === currentPlayer.position && 
    !isActionPending &&
    !hasActedThisRound.current &&  // Don't show buttons if we already acted this round
    !currentPlayer.isFolded &&
    !currentPlayer.isAllIn
  );
  
  // Debug logging for turn issues
  useEffect(() => {
    if (game && currentPlayer) {
      console.log('[Turn Debug]', {
        gamePosition: game.currentPlayerPosition,
        myPosition: currentPlayer.position,
        isFolded: currentPlayer.isFolded,
        isAllIn: currentPlayer.isAllIn,
        isActionPending,
        isCurrentPlayerTurn,
        gameStatus: game.status
      });
    }
  }, [game?.currentPlayerPosition, currentPlayer?.position, currentPlayer?.isFolded, currentPlayer?.isAllIn, isActionPending, game?.status]);

  // Reset action pending state when turn moves away from current player
  const prevGameId = useRef<string | null>(null);
  const prevTurnPosition = useRef<number | null>(null);
  
  useEffect(() => {
    const gameChanged = game?.id !== prevGameId.current;
    const turnChanged = game?.currentPlayerPosition !== prevTurnPosition.current;
    
    // Only reset pending if turn moved away from the position where action was taken
    if (isActionPending && (gameChanged || turnChanged)) {
      // Check if turn moved away from our action position
      if (actedAtPosition.current !== null && 
          game?.currentPlayerPosition !== actedAtPosition.current) {
        console.log('[Failsafe] Resetting isActionPending - turn moved from action position', {
          actedPosition: actedAtPosition.current,
          newPosition: game?.currentPlayerPosition
        });
        setIsActionPending(false);
      }
    }
    
    prevGameId.current = game?.id || null;
    prevTurnPosition.current = game?.currentPlayerPosition ?? null;
  }, [game?.id, game?.currentPlayerPosition, isActionPending]);

  // Track if auto-fold has been triggered
  const autoFoldTriggered = useRef(false);
  const autoFoldGameId = useRef<string | null>(null);

  // Turn timer effect with auto-fold
  useEffect(() => {
    if (!game?.turnExpiresAt || game.status === 'complete' || game.status === 'showdown') {
      setTurnTimeLeft(null);
      autoFoldTriggered.current = false;
      autoFoldGameId.current = null;
      return;
    }

    // Reset auto-fold flag when game or turn changes
    if (autoFoldGameId.current !== game.id) {
      autoFoldTriggered.current = false;
      autoFoldGameId.current = game.id;
    }

    const updateTimer = () => {
      const expiresAt = new Date(game.turnExpiresAt!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setTurnTimeLeft(remaining);

      // Auto-fold when timer expires and it's current player's turn (client-side)
      if (remaining === 0 && isCurrentPlayerTurn && !autoFoldTriggered.current && !isActionPending) {
        autoFoldTriggered.current = true;
        handleAutoFold();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [game?.turnExpiresAt, game?.status, game?.id, isCurrentPlayerTurn, isActionPending]);

  // Server-side turn timeout check - triggered by ANY player when timer expires
  // This ensures disconnected players get auto-folded
  const serverTimeoutCheckRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (serverTimeoutCheckRef.current) {
      clearInterval(serverTimeoutCheckRef.current);
      serverTimeoutCheckRef.current = null;
    }
    
    if (!game?.turnExpiresAt || game.status === 'complete' || game.status === 'showdown') {
      return;
    }

    const checkServerTimeout = async () => {
      const currentGame = gameRef.current;
      if (!currentGame?.turnExpiresAt) return;
      
      const expiresAt = new Date(currentGame.turnExpiresAt).getTime();
      const now = Date.now();
      
      // Only check server if turn has expired (with 2 second buffer)
      if (now > expiresAt + 2000) {
        try {
          console.log('Checking server for turn timeout...');
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session?.access_token) return;
          
          const { data } = await supabase.functions.invoke('poker-game', {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`
            },
            body: {
              action: 'check_turn_timeout',
              tableId
            }
          });
          
          if (data?.expired && data?.autoFolded) {
            console.log('Server auto-folded player:', data.autoFolded);
          }
        } catch (error) {
          console.error('Server timeout check failed:', error);
        }
      }
    };

    // Check every 3 seconds after timer expires
    serverTimeoutCheckRef.current = setInterval(checkServerTimeout, 3000);
    
    return () => {
      if (serverTimeoutCheckRef.current) {
        clearInterval(serverTimeoutCheckRef.current);
        serverTimeoutCheckRef.current = null;
      }
    };
  }, [game?.turnExpiresAt, game?.status, tableId]);

  const handleAutoFold = async () => {
    if (!game || isActionPending) return;
    
    setIsActionPending(true);
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) {
        setIsActionPending(false);
        return;
      }

      console.log('Auto-folding due to timer expiry');
      
      await supabase.functions.invoke('poker-game', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          action: 'auto_fold',
          tableId,
          gameId: game.id
        }
      });
      
      toast({
        title: 'Time expired',
        description: 'Your turn timed out - automatically folded.',
        variant: 'default'
      });
    } catch (error) {
      console.error('Auto-fold failed:', error);
    } finally {
      setTimeout(() => {
        setIsActionPending(false);
        autoFoldTriggered.current = false;
      }, 500);
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
    // Fetch the most recent game, including complete/showdown for winner display
    const { data: latestGame } = await supabase
      .from('games')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestGame) {
      const newGame: Game = {
        id: latestGame.id,
        tableId: latestGame.table_id,
        status: latestGame.status as Game['status'],
        pot: latestGame.pot,
        communityCards: (latestGame.community_cards || []).map((c: string) => stringToCard(c)),
        currentBet: latestGame.current_bet,
        dealerPosition: latestGame.dealer_position,
        currentPlayerPosition: latestGame.current_player_position,
        turnExpiresAt: latestGame.turn_expires_at
      };
      setGame(newGame);
      gameRef.current = newGame;
      
      // Clear my cards if game is complete
      if (latestGame.status === 'complete') {
        setMyCards([]);
      }
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
      .select('id, user_id, position, stack, current_bet, is_folded, is_all_in, is_active, is_sitting_out, hole_cards')
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
        isSittingOut: p.is_sitting_out ?? false,
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

  const toggleSitOut = async () => {
    if (!currentPlayer) return;

    const newSittingOut = !currentPlayer.isSittingOut;

    const { error } = await supabase
      .from('table_players')
      .update({ is_sitting_out: newSittingOut })
      .eq('id', currentPlayer.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle sit out status.',
        variant: 'destructive'
      });
      return;
    }

    await fetchPlayers();
    toast({
      title: newSittingOut ? 'Sitting out' : 'Back in game',
      description: newSittingOut 
        ? 'You will skip the next hands until you sit back in.' 
        : 'You will be dealt cards in the next hand.'
    });
  };

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

    // Check if the user already has an existing record at this table
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

      // Reactivate existing seat - Reset ALL player state when rejoining
      // Player joins as folded if a hand is in progress, will play next hand
      const currentGame = gameRef.current;
      const isHandInProgress = !!(currentGame && 
        currentGame.status !== 'complete' && 
        currentGame.status !== 'showdown' && 
        currentGame.status !== 'waiting');

      const { error } = await supabase
        .from('table_players')
        .update({
          is_active: true,
          stack: buyIn,
          current_bet: 0,
          is_folded: isHandInProgress,
          is_all_in: false,
          is_sitting_out: false,
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
      
      // Clear local cards state
      setMyCards([]);
      
      toast({
        title: 'Joined table!',
        description: isHandInProgress 
          ? `You've rejoined with ${buyIn} chips. You'll play in the next hand.`
          : `You've rejoined with ${buyIn} chips.`
      });
      return;
    }

    // New player - find an available seat
    // Get ALL players at the table (both active and inactive) to find truly empty positions
    const { data: allTablePlayers } = await supabase
      .from('table_players')
      .select('position, is_active, user_id')
      .eq('table_id', tableId);

    // Find positions that are truly empty (no record at all, or inactive records that belong to OTHER users)
    const activePositions = new Set(
      (allTablePlayers || [])
        .filter(p => p.is_active)
        .map(p => p.position)
    );
    
    // Check if current user has an inactive record
    const myInactiveRecord = (allTablePlayers || []).find(
      p => !p.is_active && p.user_id === user.id
    );
    
    // If user has an inactive record, we should have handled it above
    // So now we need to find positions not taken by active players
    const availablePositions = Array.from({ length: 9 }, (_, i) => i)
      .filter(pos => !activePositions.has(pos));

    if (availablePositions.length === 0) {
      toast({
        title: 'Table full',
        description: 'All seats are currently occupied.',
        variant: 'destructive'
      });
      return;
    }

    // Check if a hand is in progress - new players join as folded
    const currentGame = gameRef.current;
    const isHandInProgress = !!(currentGame && 
      currentGame.status !== 'complete' && 
      currentGame.status !== 'showdown' && 
      currentGame.status !== 'waiting');

    // Try to insert with retry logic for position conflicts
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Re-fetch to get current state
      const { data: currentActivePlayers } = await supabase
        .from('table_players')
        .select('position')
        .eq('table_id', tableId)
        .eq('is_active', true);

      const takenPositions = new Set((currentActivePlayers || []).map(p => p.position));
      const availablePosition = Array.from({ length: 9 }, (_, i) => i)
        .find(pos => !takenPositions.has(pos));

      if (availablePosition === undefined) {
        toast({
          title: 'Table full',
          description: 'All seats are currently occupied.',
          variant: 'destructive'
        });
        return;
      }

      // Check if there's an existing inactive record at this position from another user
      const { data: existingAtPosition } = await supabase
        .from('table_players')
        .select('id')
        .eq('table_id', tableId)
        .eq('position', availablePosition)
        .maybeSingle();

      if (existingAtPosition) {
        // Position has an inactive record, try another position
        continue;
      }

      const { error } = await supabase
        .from('table_players')
        .insert({
          table_id: tableId,
          user_id: user.id,
          position: availablePosition,
          stack: buyIn,
          current_bet: 0,
          is_folded: isHandInProgress,
          is_all_in: false,
          is_active: true,
          is_sitting_out: false,
          hole_cards: []
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
          description: isHandInProgress 
            ? `You've joined with ${buyIn} chips. You'll play in the next hand.`
            : `You've joined with ${buyIn} chips.`
        });
        return;
      }

      if (error.code === '23505') {
        console.log(`Position ${availablePosition} conflict, retrying...`);
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
    // Auto-fold when leaving during any active game state (including preflop/waiting)
    if (currentGame && 
        currentGame.status !== 'complete' && 
        currentGame.status !== 'showdown' &&
        !currentPlayer.isFolded) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          await supabase.functions.invoke('poker-game', {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`
            },
            body: {
              action: 'perform_action',
              tableId,
              gameId: currentGame.id,
              actionType: 'fold'
            }
          });
        }
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

  // Effect to auto-leave when pending stand up and hand completes
  useEffect(() => {
    if (!isPendingStandUp || !currentPlayer) return;
    
    const currentGame = gameRef.current;
    const isHandComplete = !currentGame || 
      currentGame.status === 'complete' || 
      currentGame.status === 'showdown';
    
    if (isHandComplete) {
      // Hand is complete, now leave
      const doStandUp = async () => {
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
        setIsPendingStandUp(false);
        toast({
          title: 'Stood up',
          description: `${currentPlayer.stack} chips returned to your balance.`
        });
      };
      
      doStandUp();
    }
  }, [isPendingStandUp, game?.status, currentPlayer, profile, user?.id, refreshProfile, fetchPlayers, toast]);

  // Stand up queues player to leave after current hand ends
  const standUp = async () => {
    if (!currentPlayer || isPendingStandUp) return;

    const currentGame = gameRef.current;
    const isHandInProgress = currentGame && 
      currentGame.status !== 'complete' && 
      currentGame.status !== 'showdown' &&
      currentGame.status !== 'waiting';
    
    if (isHandInProgress) {
      // Queue to stand up after hand - mark as sitting out
      await supabase
        .from('table_players')
        .update({ is_sitting_out: true })
        .eq('id', currentPlayer.id);
      
      setIsPendingStandUp(true);
      
      toast({
        title: 'Standing up after this hand',
        description: 'You will leave when the current hand completes.'
      });
      
      return;
    }

    // No hand in progress - leave immediately
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
      title: 'Stood up',
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
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast({
          title: 'Session expired',
          description: 'Please refresh the page.',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('poker-game', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          action: 'start_hand',
          tableId
        }
      });

      // Handle both network errors and API errors returned in data.error
      if (error || data?.error) {
        console.error('Start hand error:', error || data?.error);
        const errorMsg = error?.message || data?.error || 'Unknown error';
        toast({
          title: 'Failed to start hand',
          description: errorMsg,
          variant: 'destructive'
        });
        return;
      }

      if (data?.yourCards) {
        setMyCards(data.yourCards.map((c: string) => stringToCard(c)));
      }

      // Fetch fresh player/game state after hand starts
      await fetchGame();
      await fetchPlayers();
      
      // Also fetch my cards explicitly in case they weren't returned
      await fetchMyCards();

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
    
    // Debug logging
    console.log('[performAction] Called with:', { 
      action, 
      amount,
      hasGame: !!currentGame,
      hasCurrentPlayer: !!currentPlayer,
      isCurrentPlayerTurn,
      isActionPending,
      currentPlayerPosition: currentGame?.currentPlayerPosition,
      myPosition: currentPlayer?.position
    });
    
    if (!currentGame) {
      toast({
        title: 'No active game',
        description: 'Please wait for the hand to start.',
        variant: 'destructive'
      });
      return;
    }
    
    if (!currentPlayer) {
      toast({
        title: 'Not seated',
        description: 'Please join the table first.',
        variant: 'destructive'
      });
      return;
    }
    
    if (isActionPending) {
      console.log('[performAction] Blocked - action already pending');
      return;
    }
    
    if (!isCurrentPlayerTurn) {
      toast({
        title: 'Not your turn',
        description: `Waiting for position ${currentGame.currentPlayerPosition} (you are at ${currentPlayer.position})`,
        variant: 'destructive'
      });
      return;
    }

    // Set pending to prevent double-clicks and mark that we've acted this round
    setIsActionPending(true);
    hasActedThisRound.current = true;
    actedAtPosition.current = currentPlayer.position;

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
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          action: 'perform_action',
          tableId,
          gameId: currentGame.id,
          actionType: action,
          amount
        }
      });

      // Handle both network errors and API errors returned in data.error
      if (error || data?.error) {
        console.error('Action error:', error || data?.error);
        // Revert optimistic update on error
        await fetchGame();
        await fetchPlayers();
        
        const errorMsg = error?.message || data?.error || 'Unknown error';
        let errorMessage = 'Please try again.';
        if (errorMsg.includes('401') || errorMsg.includes('session') || errorMsg.includes('expired')) {
          errorMessage = 'Session expired. Please refresh the page.';
        } else if (errorMsg.includes('turn')) {
          errorMessage = 'Not your turn.';
        } else {
          errorMessage = errorMsg;
        }
        toast({
          title: 'Action failed',
          description: errorMessage,
          variant: 'destructive'
        });
        setIsActionPending(false);
        return;
      }

      // Handle game completion (fold win or showdown)
      if (data?.status === 'complete' || data?.status === 'showdown') {
        // Clear current player position and fetch fresh data
        setGame(prev => prev ? { 
          ...prev, 
          status: data.status,
          currentPlayerPosition: null,
          pot: 0 
        } : prev);
        
        // Fetch fresh data to get updated stacks
        setTimeout(async () => {
          await Promise.all([fetchGame(), fetchPlayers()]);
        }, 100);
      } else if (data?.nextPlayerPosition !== undefined) {
        // Update with server response for accurate turn indicator
        setGame(prev => prev ? { ...prev, currentPlayerPosition: data.nextPlayerPosition } : prev);
        setPlayers(prev => prev.map(p => ({
          ...p,
          isCurrentPlayer: p.position === data.nextPlayerPosition
        })));
        
        // Only clear pending if turn moved away from us
        // The failsafe effect will handle this via the window variable
        if (data.nextPlayerPosition !== currentPlayer.position) {
          setIsActionPending(false);
          (window as any).__actionCompletedPosition = undefined;
        }
      } else {
        // No next position info, clear pending after a short delay
        setTimeout(() => {
          setIsActionPending(false);
          (window as any).__actionCompletedPosition = undefined;
        }, 300);
      }
      
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

  // Presence tracking for disconnect detection
  useEffect(() => {
    if (!user?.id || !isJoined) return;

    const presenceChannel = supabase.channel(`presence-${tableId}`, {
      config: { presence: { key: user.id } }
    });

    presenceChannel
      .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
        // When a player leaves (closes browser/disconnects), auto-fold them if it's their turn
        for (const presence of leftPresences) {
          const leftUserId = presence.user_id;
          const currentGame = gameRef.current;
          const currentPlayers = playersRef.current;
          
          if (!currentGame || currentGame.status === 'complete' || currentGame.status === 'showdown') continue;
          
          const leftPlayer = currentPlayers.find(p => p.userId === leftUserId);
          if (leftPlayer && leftPlayer.isCurrentPlayer && !leftPlayer.isFolded) {
            console.log('Player disconnected during their turn, auto-folding:', leftUserId);
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.access_token) {
                await supabase.functions.invoke('poker-game', {
                  headers: {
                    Authorization: `Bearer ${sessionData.session.access_token}`
                  },
                  body: {
                    action: 'auto_fold',
                    tableId,
                    gameId: currentGame.id,
                    disconnectedUserId: leftUserId
                  }
                });
              }
            } catch (error) {
              console.error('Auto-fold disconnected player failed:', error);
            }
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [tableId, user?.id, isJoined]);

  // Realtime subscriptions - INSTANT sync for all users
  useEffect(() => {
    let lastGameStatus = gameRef.current?.status || null;
    
    const handleGameUpdate = async (payload: any) => {
      const newData = payload?.new;
      if (newData?.status && newData.status !== lastGameStatus) {
        lastGameStatus = newData.status;
        if (newData.community_cards) {
          setGame(prev => prev ? {
            ...prev,
            status: newData.status,
            communityCards: newData.community_cards.map((c: string) => stringToCard(c)),
            pot: newData.pot ?? prev.pot,
            currentBet: newData.current_bet ?? prev.currentBet,
            currentPlayerPosition: newData.current_player_position,
            turnExpiresAt: newData.turn_expires_at
          } : prev);
        }
      }
      await Promise.all([fetchGame(), fetchPlayers(), fetchMyCards()]);
    };

    const handlePlayerUpdate = async (payload: any) => {
      const isMyAction = payload?.new?.user_id === userIdRef.current;
      if (isActionPending && isMyAction) return;
      await Promise.all([fetchGame(), fetchPlayers(), fetchMyCards()]);
    };
    
    const channel = supabase
      .channel(`table-realtime-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `table_id=eq.${tableId}` }, handleGameUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${tableId}` }, handlePlayerUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_tables', filter: `id=eq.${tableId}` }, fetchTable)
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
    isPendingStandUp,
    joinTable,
    leaveTable,
    standUp,
    startHand,
    performAction,
    toggleSitOut
  };
}
