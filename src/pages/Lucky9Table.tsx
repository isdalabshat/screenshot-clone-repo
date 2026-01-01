import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Coins, Play, Layers } from 'lucide-react';
import { CashInOutButtons } from '@/components/CashInOutButtons';
import { Lucky9Table, Lucky9Game, Lucky9Player } from '@/types/lucky9';
import { Lucky9BetPanel } from '@/components/lucky9/Lucky9BetPanel';
import { Lucky9ActionButtons } from '@/components/lucky9/Lucky9ActionButtons';
import { Lucky9GameStatus } from '@/components/lucky9/Lucky9GameStatus';
import { Lucky9RoleDialog } from '@/components/lucky9/Lucky9RoleDialog';
import { Lucky9BettingTimer } from '@/components/lucky9/Lucky9BettingTimer';
import { Lucky9GamblingTable } from '@/components/lucky9/Lucky9GamblingTable';
import Lucky9Chat from '@/components/lucky9/Lucky9Chat';
import Lucky9EmojiReactions from '@/components/lucky9/Lucky9EmojiReactions';
import { Lucky9WinnerAnimation } from '@/components/lucky9/Lucky9WinnerAnimation';
import { Lucky9HiritCard, Lucky9DealSequence } from '@/components/lucky9/Lucky9FloatingCard';
import { useLucky9Sounds } from '@/hooks/useLucky9Sounds';

interface PlayerEmoji {
  id: string;
  emoji: string;
  username: string;
  userId: string;
}

interface PlayerEmojiState {
  [playerId: string]: string | null;
}

interface PlayerDecisionState {
  [playerId: string]: 'hirit' | 'good' | null;
}

export default function Lucky9TablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { playSound, playDealSequence } = useLucky9Sounds();

  const [table, setTable] = useState<Lucky9Table | null>(null);
  const [game, setGame] = useState<Lucky9Game | null>(null);
  const [players, setPlayers] = useState<Lucky9Player[]>([]);
  const [myPlayer, setMyPlayer] = useState<Lucky9Player | null>(null);
  const [remainingDeck, setRemainingDeck] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [hasBanker, setHasBanker] = useState(false);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [winners, setWinners] = useState<{ username: string; winnings: number }[]>([]);
  const [playerEmojis, setPlayerEmojis] = useState<PlayerEmojiState>({});
  const [playerDecisions, setPlayerDecisions] = useState<PlayerDecisionState>({});
  const [isDealing, setIsDealing] = useState(false);
  const [showHiritAnimation, setShowHiritAnimation] = useState(false);
  const [showDealSequence, setShowDealSequence] = useState(false);
  const [dealTargets, setDealTargets] = useState<{ x: number; y: number }[]>([]);

  const hasJoined = useRef(false);
  const prevGameStatus = useRef<string | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);

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
      .in('status', ['betting', 'accepting_bets', 'dealing', 'player_turns', 'banker_turn', 'showdown'])
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
        isBanker: p.is_banker,
        betAccepted: p.bet_accepted
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
        isBanker: existing.is_banker,
        betAccepted: existing.bet_accepted
      });
      return true;
    }
    return false;
  }, [user, tableId]);

  // Handle emoji from other players
  const handlePlayerEmoji = useCallback((emojiData: PlayerEmoji) => {
    setPlayerEmojis(prev => ({ ...prev, [emojiData.userId]: emojiData.emoji }));
    // Clear after 3 seconds
    setTimeout(() => {
      setPlayerEmojis(prev => ({ ...prev, [emojiData.userId]: null }));
    }, 3000);
  }, []);

  // Broadcast decision to other players
  const broadcastDecision = useCallback(async (decision: 'hirit' | 'good') => {
    if (!tableId || !user?.id || !profile?.username) return;
    
    await supabase.channel(`lucky9-decisions-${tableId}`).send({
      type: 'broadcast',
      event: 'decision',
      payload: { decision, userId: user.id, username: profile.username }
    });
    
    // Show own decision
    setPlayerDecisions(prev => ({ ...prev, [user.id]: decision }));
    setTimeout(() => {
      setPlayerDecisions(prev => ({ ...prev, [user.id]: null }));
    }, 2000);
  }, [tableId, user?.id, profile?.username]);

  // Subscribe to decisions and deal animation broadcast
  useEffect(() => {
    if (!tableId) return;
    
    const channel = supabase.channel(`lucky9-decisions-${tableId}`)
      .on('broadcast', { event: 'decision' }, ({ payload }) => {
        if (payload.userId !== user?.id) {
          setPlayerDecisions(prev => ({ ...prev, [payload.userId]: payload.decision }));
          // Play sound for other player's decision
          playSound(payload.decision === 'hirit' ? 'hirit' : 'good');
          setTimeout(() => {
            setPlayerDecisions(prev => ({ ...prev, [payload.userId]: null }));
          }, 2000);
        }
      })
      .on('broadcast', { event: 'deal_cards' }, ({ payload }) => {
        // Only non-bankers receive this (banker already triggers locally)
        if (!myPlayer?.isBanker) {
          setIsDealing(true);
          setShowDealSequence(true);
          playSound('shuffle');
          
          // Calculate deal targets for this player's screen
          const acceptedCount = payload.acceptedCount || 0;
          const targets: { x: number; y: number }[] = [];
          for (let i = 0; i < acceptedCount; i++) {
            const baseX = window.innerWidth / 2 - 100 + (i * 60);
            const baseY = window.innerHeight - 180;
            targets.push({ x: baseX, y: baseY });
          }
          targets.push({ x: window.innerWidth / 2 - 25, y: 120 });
          setDealTargets(targets);
          
          // Play deal sounds with delay
          setTimeout(() => {
            playDealSequence(acceptedCount * 2 + 2);
          }, 300);
          
          setTimeout(() => {
            setIsDealing(false);
            setShowDealSequence(false);
            setDealTargets([]);
          }, 1500);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, user?.id, playSound, playDealSequence, myPlayer?.isBanker]);

  // Sound effects based on game state changes - NO deal animation here (handled in startRound)
  useEffect(() => {
    if (!game?.status) return;
    
    const currentStatus = game.status;
    const prevStatus = prevGameStatus.current;
    
    // Only track status changes for non-finished states (finished handling is in separate useEffect)
    if (prevStatus !== currentStatus && currentStatus !== 'finished') {
      prevGameStatus.current = currentStatus;
    }
  }, [game?.status]);

  // Play turn sound when it's my turn
  useEffect(() => {
    const isMyTurn = game?.status === 'player_turns' && myPlayer && !myPlayer.isBanker && game.currentPlayerPosition === myPlayer.position && !myPlayer.hasActed;
    const isBankerTurn = game?.status === 'banker_turn' && myPlayer?.isBanker && !myPlayer.hasActed;
    
    if (isMyTurn || isBankerTurn) {
      playSound('turn');
    }
  }, [game?.status, game?.currentPlayerPosition, myPlayer, playSound]);

  const joinTable = async (role: 'banker' | 'player') => {
    if (!user || !tableId || !profile) return;
    setIsProcessing(true);
    setShowRoleDialog(false);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'join_table', tableId, userId: user.id, username: profile.username, role, stack: profile.chips }
    });

    if (!error && !data?.error) {
      // Deduct chips from profile
      await supabase.from('profiles').update({ chips: 0 }).eq('user_id', user.id);
      fetchPlayers();
    }
    setIsProcessing(false);
  };

  const leaveTable = async () => {
    if (!myPlayer) return;

    const action = myPlayer.isBanker ? 'banker_leave' : 'player_leave';
    await supabase.functions.invoke('lucky9-game', {
      body: { action, tableId, userId: user?.id }
    });
    
    navigate('/lucky9');
  };

  const handleBettingTimerEnd = async () => {
    if (!tableId || !game) return;
    
    const { data } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'betting_timer_end', tableId }
    });

    if (data?.allLeft) {
      navigate('/lucky9');
    }
  };

  const placeBet = async (amount: number) => {
    if (!myPlayer) return;
    setIsProcessing(true);
    playSound('bet');

    await supabase.functions.invoke('lucky9-game', {
      body: { action: 'place_bet', tableId, playerId: myPlayer.id, amount }
    });

    setIsProcessing(false);
  };

  const handleAcceptBet = async (playerId: string) => {
    if (!myPlayer?.isBanker || !user) return;
    setIsProcessing(true);
    playSound('betAccepted');

    await supabase.functions.invoke('lucky9-game', {
      body: { action: 'accept_bet', tableId, playerId, userId: user.id }
    });

    setIsProcessing(false);
  };

  const handleRejectBet = async (playerId: string) => {
    if (!myPlayer?.isBanker || !user) return;
    setIsProcessing(true);
    playSound('betRejected');

    await supabase.functions.invoke('lucky9-game', {
      body: { action: 'reject_bet', tableId, playerId, userId: user.id }
    });

    setIsProcessing(false);
  };

  const startBetting = async () => {
    if (!tableId) return;
    setIsProcessing(true);

    await supabase.functions.invoke('lucky9-game', {
      body: { action: 'start_betting', tableId }
    });

    setIsProcessing(false);
  };

  const startRound = async () => {
    if (!game || !tableId) return;
    setIsProcessing(true);
    setIsDealing(true);
    setShowDealSequence(true);
    playSound('shuffle');

    // Calculate deal targets
    const acceptedPlayers = players.filter(p => p.betAccepted && !p.isBanker);
    const targets: { x: number; y: number }[] = [];
    
    acceptedPlayers.forEach((_, index) => {
      const baseX = window.innerWidth / 2 - 100 + (index * 60);
      const baseY = window.innerHeight - 180;
      targets.push({ x: baseX, y: baseY });
    });
    targets.push({ x: window.innerWidth / 2 - 25, y: 120 });
    setDealTargets(targets);

    // Broadcast deal animation to other players
    await supabase.channel(`lucky9-decisions-${tableId}`).send({
      type: 'broadcast',
      event: 'deal_cards',
      payload: { acceptedCount: acceptedPlayers.length }
    });

    const { data } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'start_round', tableId, gameId: game.id }
    });

    if (data?.remainingDeck) {
      setRemainingDeck(data.remainingDeck);
      setTimeout(() => {
        playDealSequence(acceptedPlayers.length * 2 + 2);
      }, 300);
    }
    setTimeout(() => {
      setIsDealing(false);
      setShowDealSequence(false);
      setDealTargets([]);
    }, 1500);
    setIsProcessing(false);
  };

  const handlePlayerAction = async (playerAction: 'draw' | 'stand') => {
    if (!myPlayer || !game) return;
    setIsProcessing(true);

    // Broadcast decision to other players
    broadcastDecision(playerAction === 'draw' ? 'hirit' : 'good');
    
    // Play sound
    playSound(playerAction === 'draw' ? 'hirit' : 'good');

    if (playerAction === 'draw') {
      setIsDealing(true);
      setShowHiritAnimation(true);
      setTimeout(() => {
        setIsDealing(false);
        setShowHiritAnimation(false);
      }, 500);
    }

    const action = myPlayer.isBanker ? 'banker_action' : 'player_action';
    const { data } = await supabase.functions.invoke('lucky9-game', {
      body: { action, tableId, playerId: myPlayer.id, gameId: game.id, actionType: playerAction, userId: user?.id }
    });

    if (data?.remainingDeck) {
      setRemainingDeck(data.remainingDeck);
      if (playerAction === 'draw') {
        playSound('deal');
      }
    }
    // Handle auto-kicked players
    if (data?.kickedPlayers && data.kickedPlayers.length > 0) {
      if (data.kickedPlayers.includes(user?.id)) {
        setTimeout(() => navigate('/lucky9'), 2000);
      }
    }
    setIsProcessing(false);
  };

  const resetRound = async () => {
    if (!tableId) return;
    setShowWinnerAnimation(false);
    setWinners([]);
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

  // Handle showdown/finished state - show cards and winner animation for exactly 5 seconds
  const resultsShownRef = useRef(false);
  const resultsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastGameIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Trigger on finished status
    const isResultsPhase = game?.status === 'finished';
    const gameId = game?.id || null;
    
    // Only trigger once per game - use game ID to track
    if (isResultsPhase && gameId && lastGameIdRef.current !== gameId) {
      lastGameIdRef.current = gameId;
      resultsShownRef.current = true;
      
      // Clear any existing timeout
      if (resultsTimeoutRef.current) {
        clearTimeout(resultsTimeoutRef.current);
        resultsTimeoutRef.current = null;
      }
      
      console.log('Results phase started - will show for 5 seconds');
      
      // Show winner animation immediately
      const gameWinners = players.filter(p => p.winnings > 0).map(p => ({
        username: p.username,
        winnings: p.winnings
      }));
      if (gameWinners.length > 0) {
        setWinners(gameWinners);
        setShowWinnerAnimation(true);
        playSound('win');
      }
      
      // Reset round after EXACTLY 5 seconds of showing results
      resultsTimeoutRef.current = setTimeout(() => {
        console.log('5 seconds elapsed - resetting round now');
        resultsShownRef.current = false;
        setShowWinnerAnimation(false);
        setWinners([]);
        resetRound();
      }, 5000);
    }
    
    // Cleanup on unmount only
    return () => {
      // Don't clear timeout on re-renders, only on unmount
    };
  }, [game?.status, game?.id]);
  
  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (resultsTimeoutRef.current) {
        clearTimeout(resultsTimeoutRef.current);
      }
    };
  }, []);

  const banker = players.find(p => p.isBanker);
  const nonBankerPlayers = players.filter(p => !p.isBanker);
  
  // Game can only proceed if there's a banker
  const hasActiveBanker = !!banker;
  
  // Action conditions - only when there's a banker
  const isMyTurn = hasActiveBanker && game?.status === 'player_turns' && myPlayer && !myPlayer.isBanker && game.currentPlayerPosition === myPlayer.position && !myPlayer.hasActed;
  const isBankerTurn = hasActiveBanker && game?.status === 'banker_turn' && myPlayer?.isBanker && !myPlayer.hasActed;
  
  // Check if any players have placed bets that need acceptance
  const playersWithPendingBets = nonBankerPlayers.filter(p => p.currentBet > 0 && p.betAccepted === null);
  const playersWithAcceptedBets = nonBankerPlayers.filter(p => p.currentBet > 0 && p.betAccepted === true);
  
  // Banker can start betting only when there are players and no active game
  const canStartBetting = !game && myPlayer?.isBanker && nonBankerPlayers.length >= 1;
  
  // Banker can deal cards when all pending bets are decided and at least one bet is accepted
  const canDealCards = game?.status === 'betting' && myPlayer?.isBanker && playersWithPendingBets.length === 0 && playersWithAcceptedBets.length > 0;
  
  // Show bet panel only when there's a banker and betting phase and player hasn't bet yet
  const showBetPanel = hasActiveBanker && game?.status === 'betting' && myPlayer && !myPlayer.isBanker && myPlayer.currentBet === 0;
  
  // Action buttons only visible when banker exists and it's player's turn
  const showActionButtons = hasActiveBanker && (isMyTurn || isBankerTurn);

  // Is current user the banker
  const iAmBanker = myPlayer?.isBanker;

  const handleCardReveal = (playerId: string, cardIndex: number) => {
    playSound('cardFlip');
    console.log(`Card ${cardIndex} revealed for player ${playerId}`);
  };

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-950 via-slate-900 to-green-950">
        <div className="animate-pulse text-xl text-green-400">Loading table...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-slate-900 to-green-950 pb-28 overflow-x-hidden">
      <Lucky9RoleDialog open={showRoleDialog} hasBanker={hasBanker} onSelectRole={joinTable} onCancel={() => navigate('/lucky9')} />
      
      {/* Winner Animation */}
      <Lucky9WinnerAnimation 
        winners={winners} 
        show={showWinnerAnimation} 
        onComplete={() => setShowWinnerAnimation(false)} 
      />

      {/* Compact header for mobile */}
      <header className="border-b border-green-500/30 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="flex justify-between items-center px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={leaveTable} className="h-7 w-7">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div>
              <h1 className="text-xs font-bold text-green-400">{table.name}</h1>
              <p className="text-[9px] text-muted-foreground">₱{table.minBet} - ₱{table.maxBet}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Cash In/Out Buttons */}
            {user && profile && <CashInOutButtons userId={user.id} userChips={profile.chips} />}
            
            {myPlayer && (
              <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg border border-yellow-500/30">
                <Coins className="h-3 w-3 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">₱{myPlayer.stack.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-2 py-2 space-y-2">
        {/* Game status */}
        <Lucky9GameStatus 
          status={hasActiveBanker ? (game?.status || 'waiting') : 'waiting_banker'} 
          currentPlayerName={players.find(p => p.position === game?.currentPlayerPosition)?.username}
          bankerName={banker?.username}
          message={!hasActiveBanker ? 'Waiting for a banker to join...' : undefined}
        />

        {/* Betting timer */}
        {hasActiveBanker && game?.bettingEndsAt && game.status === 'betting' && (
          <div className="max-w-[200px] mx-auto">
            <Lucky9BettingTimer bettingEndsAt={game.bettingEndsAt} onTimeUp={handleBettingTimerEnd} />
          </div>
        )}

        {/* Gambling table */}
        <Lucky9GamblingTable 
          players={players} 
          banker={banker || null} 
          game={game} 
          currentUserId={user?.id}
          isBankerView={iAmBanker}
          onAcceptBet={handleAcceptBet}
          onRejectBet={handleRejectBet}
          isProcessing={isProcessing}
          onCardReveal={handleCardReveal}
          playerEmojis={playerEmojis}
          playerDecisions={playerDecisions}
          isDealing={isDealing}
          isShowdown={game?.status === 'finished'}
        />

        {/* Floating card animations - Deal Sequence */}
        {showDealSequence && dealTargets.length > 0 && (
          <Lucky9DealSequence
            isDealing={showDealSequence}
            deckPosition={{ x: window.innerWidth / 2 - 25, y: window.innerHeight / 2 - 50 }}
            targets={dealTargets}
            onComplete={() => {
              setShowDealSequence(false);
              setDealTargets([]);
            }}
          />
        )}

        {/* Hirit card animation */}
        <Lucky9HiritCard
          isAnimating={showHiritAnimation}
          deckPosition={{ x: window.innerWidth / 2 - 25, y: window.innerHeight / 2 - 50 }}
          targetPosition={{ x: window.innerWidth / 2 - 25, y: window.innerHeight - 200 }}
          onComplete={() => setShowHiritAnimation(false)}
        />

        {/* Banker controls */}
        {hasActiveBanker && (canStartBetting || canDealCards) && (
          <div className="flex justify-center gap-2 pt-1">
            {canStartBetting && (
              <Button 
                onClick={startBetting} 
                disabled={isProcessing} 
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 px-4 py-3 text-sm font-bold rounded-xl shadow-lg shadow-green-500/30"
              >
                <Play className="h-4 w-4 mr-1.5" />
                Start Betting
              </Button>
            )}
            {canDealCards && (
              <Button 
                onClick={startRound} 
                disabled={isProcessing} 
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-3 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/30"
              >
                <Layers className="h-4 w-4 mr-1.5" />
                Deal Cards
              </Button>
            )}
          </div>
        )}

        {/* Pending bets info for banker */}
        {iAmBanker && game?.status === 'betting' && playersWithPendingBets.length > 0 && (
          <div className="text-center py-1">
            <p className="text-amber-400 text-xs">
              {playersWithPendingBets.length} player(s) waiting for bet acceptance
            </p>
          </div>
        )}

        {/* Waiting for banker message for players */}
        {!hasActiveBanker && myPlayer && !myPlayer.isBanker && (
          <div className="text-center py-2">
            <p className="text-amber-400/70 text-xs">Waiting for a banker to start the game...</p>
          </div>
        )}

        {/* Player bet status */}
        {myPlayer && !myPlayer.isBanker && myPlayer.currentBet > 0 && game?.status === 'betting' && (
          <div className="text-center py-1">
            {myPlayer.betAccepted === null && (
              <p className="text-yellow-400 text-xs animate-pulse">Waiting for banker to accept your bet...</p>
            )}
            {myPlayer.betAccepted === true && (
              <p className="text-green-400 text-xs">✓ Your bet of ₱{myPlayer.currentBet} has been accepted!</p>
            )}
            {myPlayer.betAccepted === false && (
              <p className="text-red-400 text-xs">✗ Your bet was rejected. Your chips have been returned.</p>
            )}
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
          onTimeout={() => handlePlayerAction('stand')}
        />
      )}

      {/* Chat and Emoji Reactions */}
      <Lucky9Chat 
        tableId={tableId || ''} 
        userId={user?.id} 
        username={profile?.username} 
      />
      <Lucky9EmojiReactions 
        tableId={tableId || ''} 
        userId={user?.id} 
        username={profile?.username} 
        isJoined={!!myPlayer}
        onPlayerEmoji={handlePlayerEmoji}
      />
    </div>
  );
}
