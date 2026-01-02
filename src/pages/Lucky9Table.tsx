import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Coins, Play, Layers, Eye, Clock, UserX } from 'lucide-react';
import { CashInOutButtons } from '@/components/CashInOutButtons';
import { Lucky9Table, Lucky9Game, Lucky9Player, Lucky9Role } from '@/types/lucky9';
import { Lucky9BetPanel } from '@/components/lucky9/Lucky9BetPanel';
import { Lucky9ActionButtons } from '@/components/lucky9/Lucky9ActionButtons';
import { Lucky9GameStatus } from '@/components/lucky9/Lucky9GameStatus';
import { Lucky9RoleDialog } from '@/components/lucky9/Lucky9RoleDialog';
import { Lucky9BettingTimer } from '@/components/lucky9/Lucky9BettingTimer';
import { Lucky9GamblingTable } from '@/components/lucky9/Lucky9GamblingTable';
import Lucky9Chat from '@/components/lucky9/Lucky9Chat';
import Lucky9EmojiReactions from '@/components/lucky9/Lucky9EmojiReactions';
import { Lucky9HiritCard, Lucky9DealSequence, getPlayerSeatPosition } from '@/components/lucky9/Lucky9FloatingCard';
import { Lucky9ChipAnimation, useLucky9ChipAnimations, getChipAnimationPosition } from '@/components/lucky9/Lucky9ChipAnimation';
import { useLucky9Sounds } from '@/hooks/useLucky9Sounds';
import { useToast } from '@/hooks/use-toast';

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
  const { animations: chipAnimations, triggerAnimations, clearAnimations } = useLucky9ChipAnimations();
  const { toast } = useToast();

  const [table, setTable] = useState<Lucky9Table | null>(null);
  const [game, setGame] = useState<Lucky9Game | null>(null);
  const [players, setPlayers] = useState<Lucky9Player[]>([]);
  const [myPlayer, setMyPlayer] = useState<Lucky9Player | null>(null);
  const [remainingDeck, setRemainingDeck] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [hasBanker, setHasBanker] = useState(false);
  const [playerEmojis, setPlayerEmojis] = useState<PlayerEmojiState>({});
  const [playerDecisions, setPlayerDecisions] = useState<PlayerDecisionState>({});
  const [isDealing, setIsDealing] = useState(false);
  const [showHiritAnimation, setShowHiritAnimation] = useState(false);
  const [hiritTargetPosition, setHiritTargetPosition] = useState({ x: 0, y: 0 });
  const [showDealSequence, setShowDealSequence] = useState(false);
  const [dealTargets, setDealTargets] = useState<{ x: number; y: number }[]>([]);
  const [isSpectator, setIsSpectator] = useState(false);
  const [forceSpectatorMode, setForceSpectatorMode] = useState(false);
  const [forceSpectatorReason, setForceSpectatorReason] = useState<'balance' | 'full'>('balance');
  const [hiritTargetPlayerId, setHiritTargetPlayerId] = useState<string | null>(null);
  const [callTimeRemaining, setCallTimeRemaining] = useState<number | null>(null);

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
        betTimerSeconds: data.bet_timer_seconds,
        callTimeMinutes: data.call_time_minutes,
        callTimeStartedAt: data.call_time_started_at,
        callTimeBankerId: data.call_time_banker_id
      });
    }
  }, [tableId]);

  const fetchGame = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from('lucky9_games')
      .select('*')
      .eq('table_id', tableId)
      .in('status', ['betting', 'accepting_bets', 'dealing', 'player_turns', 'banker_turn', 'calculating', 'revealing', 'showdown'])
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

  // Subscribe to decisions, deal animation, and hirit animation broadcast
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
          
          // Calculate deal targets using actual player seat positions
          const acceptedCount = payload.acceptedCount || 0;
          const activePlayers = players.filter(p => p.betAccepted && !p.isBanker);
          const targets: { x: number; y: number }[] = [];
          
          // Get actual seat positions from DOM for each player
          activePlayers.slice(0, acceptedCount).forEach((player) => {
            const seatPos = getPlayerSeatPosition(player.id, false);
            if (seatPos) {
              targets.push(seatPos);
            }
          });
          
          // Add banker position
          const bankerPos = getPlayerSeatPosition('banker', true);
          if (bankerPos) {
            targets.push(bankerPos);
          }
          
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
      .on('broadcast', { event: 'hirit_card' }, ({ payload }) => {
        // Show hirit animation to all players - animate to the correct player/banker
        setIsDealing(true);
        setShowHiritAnimation(true);
        setHiritTargetPlayerId(payload.playerId);
        
        // Get position of the player/banker who did hirit
        setTimeout(() => {
          const pos = getPlayerSeatPosition(payload.playerId, payload.isBanker);
          setHiritTargetPosition(pos || { x: window.innerWidth / 2 - 25, y: window.innerHeight - 200 });
        }, 50);
        
        if (payload.userId !== user?.id) {
          playSound('hirit');
        }
        
        // Clear animation after completion
        setTimeout(() => {
          setIsDealing(false);
          setShowHiritAnimation(false);
          setHiritTargetPlayerId(null);
        }, 600);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, user?.id, playSound, playDealSequence, myPlayer?.isBanker, players]);

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

  const joinTable = async (role: Lucky9Role) => {
    if (!user || !tableId || !profile) return;
    
    // Handle spectator mode
    if (role === 'spectator') {
      setIsSpectator(true);
      setShowRoleDialog(false);
      playSound('spectatorJoin');
      return;
    }
    
    setIsProcessing(true);
    setShowRoleDialog(false);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'join_table', tableId, userId: user.id, username: profile.username, role, stack: profile.chips }
    });

    if (!error && !data?.error) {
      // Deduct chips from profile
      await supabase.from('profiles').update({ chips: 0 }).eq('user_id', user.id);
      fetchPlayers();
    } else if (data?.error?.includes('Insufficient balance')) {
      // Force spectator mode if balance too low
      setForceSpectatorMode(true);
      setForceSpectatorReason('balance');
      setShowRoleDialog(true);
    }
    setIsProcessing(false);
  };

  const leaveTable = async () => {
    // Allow spectators to leave without having a player record
    if (isSpectator) {
      navigate('/lucky9');
      return;
    }
    
    if (!myPlayer) return;

    const action = myPlayer.isBanker ? 'banker_leave' : 'player_leave';
    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action, tableId, userId: user?.id }
    });
    
    // Check for Call Time restriction error
    if (data?.callTimeActive) {
      playSound('betRejected');
      toast({
        title: '🔒 Call Time Active',
        description: `You cannot leave while Call Time is active. Wait for the banker to leave or for the timer to expire (${Math.ceil((callTimeRemaining || 0) / 60)} minutes remaining).`,
        variant: 'destructive',
        duration: 5000
      });
      return;
    }
    
    if (error) {
      console.error('Leave table error:', error);
      return;
    }
    
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

    // Calculate deal targets using actual player seat positions
    const acceptedPlayers = players.filter(p => p.betAccepted && !p.isBanker);
    const targets: { x: number; y: number }[] = [];
    
    // Get actual seat positions from DOM for each accepted player
    acceptedPlayers.forEach((player) => {
      const seatPos = getPlayerSeatPosition(player.id, false);
      if (seatPos) {
        targets.push(seatPos);
      }
    });
    
    // Add banker position
    const bankerPos = getPlayerSeatPosition('banker', true);
    if (bankerPos) {
      targets.push(bankerPos);
    }
    
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
      
      // Calculate position first
      const myPos = getPlayerSeatPosition(myPlayer.id, myPlayer.isBanker);
      setHiritTargetPosition(myPos || { x: window.innerWidth / 2 - 25, y: window.innerHeight - 200 });
      
      // Broadcast hirit animation to all players with target position
      await supabase.channel(`lucky9-decisions-${tableId}`).send({
        type: 'broadcast',
        event: 'hirit_card',
        payload: { 
          userId: user?.id, 
          playerId: myPlayer.id,
          isBanker: myPlayer.isBanker,
          targetPosition: myPos || { x: window.innerWidth / 2 - 25, y: window.innerHeight - 200 }
        }
      });
      
      // Animation handled by broadcast subscriber - clear after delay
      setTimeout(() => {
        setIsDealing(false);
        setShowHiritAnimation(false);
      }, 600);
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
    // Handle auto-kicked players - redirect to spectator mode instead of lobby
    if (data?.kickedPlayers && data.kickedPlayers.length > 0) {
      if (data.kickedPlayers.includes(user?.id)) {
        setMyPlayer(null);
        setIsSpectator(true);
        playSound('spectatorJoin');
      }
    }
    setIsProcessing(false);
  };

  const handleKickPlayer = async (playerId: string) => {
    if (!user || !profile?.isAdmin) return;
    setIsProcessing(true);

    const { data, error } = await supabase.functions.invoke('lucky9-game', {
      body: { action: 'kick_player', tableId, playerId, userId: user.id }
    });

    if (!error && data?.success) {
      toast({
        title: 'Player Kicked',
        description: 'Player has been removed from the table.',
      });
      fetchPlayers();
    } else {
      toast({
        title: 'Error',
        description: data?.error || 'Failed to kick player',
        variant: 'destructive'
      });
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
          // Check if table is full
          const { data: activePlayers } = await supabase
            .from('lucky9_players')
            .select('is_banker')
            .eq('table_id', tableId)
            .eq('is_active', true);
          
          const playerCount = activePlayers?.length || 0;
          const tableMaxPlayers = table?.maxPlayers || 8;
          
          setHasBanker(activePlayers?.some(p => p.is_banker) || false);
          
          // If table is full, force spectator mode
          if (playerCount >= tableMaxPlayers) {
            setForceSpectatorMode(true);
            setForceSpectatorReason('full');
          }
          
          setShowRoleDialog(true);
        }
      }
    };
    initPlayer();
  }, [user, tableId, checkExistingPlayer, table?.maxPlayers]);

  useEffect(() => {
    if (!tableId) return;
    const channel = supabase
      .channel(`lucky9-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_games', filter: `table_id=eq.${tableId}` }, fetchGame)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lucky9_players', filter: `table_id=eq.${tableId}` }, fetchPlayers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tableId, fetchGame, fetchPlayers]);

  // Track Call Time remaining and show announcement when it ends
  const prevCallTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!table?.callTimeStartedAt || !table?.callTimeMinutes) {
      // Check if call time just ended (was active before but not now)
      if (prevCallTimeRef.current !== null && prevCallTimeRef.current > 0) {
        toast({
          title: '⏰ Call Time Ended',
          description: 'The banker has left or the Call Time has expired. You are now free to leave the table.',
          duration: 6000
        });
      }
      prevCallTimeRef.current = null;
      setCallTimeRemaining(null);
      return;
    }

    const updateCallTime = () => {
      const startTime = new Date(table.callTimeStartedAt!).getTime();
      const endTime = startTime + table.callTimeMinutes! * 60 * 1000;
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      if (remaining <= 0) {
        // Call time just expired
        if (prevCallTimeRef.current !== null && prevCallTimeRef.current > 0) {
          toast({
            title: '⏰ Call Time Ended',
            description: 'The Call Time has expired. You are now free to leave the table.',
            duration: 6000
          });
        }
        prevCallTimeRef.current = null;
        setCallTimeRemaining(null);
        // Refetch table to get updated call time status
        fetchTable();
      } else {
        prevCallTimeRef.current = remaining;
        setCallTimeRemaining(remaining);
      }
    };

    updateCallTime();
    const interval = setInterval(updateCallTime, 1000);

    return () => clearInterval(interval);
  }, [table?.callTimeStartedAt, table?.callTimeMinutes, fetchTable, toast]);

  // Handle calculating state - immediate check and transition to revealing
  const calculatingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedGameIds = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    // Only handle if this is a new calculating state for this game
    if (game?.status === 'calculating' && game?.id && !processedGameIds.current.has(`calc-${game.id}`)) {
      processedGameIds.current.add(`calc-${game.id}`);
      console.log('Calculating winner... 1 sec delay for game:', game.id);
      
      // Clear any existing timeout
      if (calculatingTimeoutRef.current) {
        clearTimeout(calculatingTimeoutRef.current);
      }
      
      // After 1 second, update to 'revealing' status
      calculatingTimeoutRef.current = setTimeout(async () => {
        console.log('Transitioning to revealing for game:', game.id);
        try {
          await supabase
            .from('lucky9_games')
            .update({ status: 'revealing' })
            .eq('id', game.id)
            .eq('status', 'calculating'); // Only update if still calculating
        } catch (err) {
          console.error('Error transitioning to revealing:', err);
        }
      }, 1000);
    }
    
    return () => {
      if (calculatingTimeoutRef.current) {
        clearTimeout(calculatingTimeoutRef.current);
      }
    };
  }, [game?.status, game?.id]);

  // Handle revealing state - show all cards for 5 seconds, then finish
  const revealingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Only handle if this is a new revealing state for this game
    if (game?.status === 'revealing' && game?.id && !processedGameIds.current.has(`reveal-${game.id}`)) {
      processedGameIds.current.add(`reveal-${game.id}`);
      console.log('Revealing all cards for 5 seconds... game:', game.id);
      
      // Play win sound if there are winners
      const gameWinners = players.filter(p => p.winnings > 0);
      if (gameWinners.length > 0) {
        playSound('win');
      }
      
      // Trigger chip animations after a short delay to let cards reveal first
      const banker = players.find(p => p.isBanker);
      if (banker) {
        setTimeout(() => {
          const bankerPos = getChipAnimationPosition(banker.id, true);
          const chipAnims: any[] = [];
          
          players.filter(p => !p.isBanker && p.result).forEach((player, index) => {
            const playerPos = getChipAnimationPosition(player.id, false);
            if (!playerPos || !bankerPos) return;
            
            if (player.result === 'win' || player.result === 'natural_win') {
              // Chips move from banker to player (player wins)
              chipAnims.push({
                id: `chip-${player.id}-${Date.now()}`,
                fromPlayerId: banker.id,
                toPlayerId: player.id,
                amount: Math.abs(player.winnings - player.currentBet), // Profit amount
                isWin: true,
                startX: bankerPos.x,
                startY: bankerPos.y,
                endX: playerPos.x,
                endY: playerPos.y
              });
            } else if (player.result === 'lose') {
              // Chips move from player to banker (player loses)
              chipAnims.push({
                id: `chip-${player.id}-${Date.now()}`,
                fromPlayerId: player.id,
                toPlayerId: banker.id,
                amount: player.currentBet,
                isWin: false,
                startX: playerPos.x,
                startY: playerPos.y,
                endX: bankerPos.x,
                endY: bankerPos.y
              });
            }
          });
          
          if (chipAnims.length > 0) {
            triggerAnimations(chipAnims);
          }
        }, 500);
      }
      
      // Clear any existing timeout
      if (revealingTimeoutRef.current) {
        clearTimeout(revealingTimeoutRef.current);
      }
      
      // After 5 seconds, mark as finished and reset
      revealingTimeoutRef.current = setTimeout(async () => {
        console.log('5 seconds reveal complete - finishing game:', game.id);
        try {
          await supabase
            .from('lucky9_games')
            .update({ status: 'finished' })
            .eq('id', game.id)
            .eq('status', 'revealing'); // Only update if still revealing
          
          // Wait a moment then reset
          setTimeout(() => {
            resetRound();
            // Clean up processed game IDs for this game
            processedGameIds.current.delete(`calc-${game.id}`);
            processedGameIds.current.delete(`reveal-${game.id}`);
          }, 500);
        } catch (err) {
          console.error('Error finishing game:', err);
        }
      }, 5000);
    }
    
    return () => {
      if (revealingTimeoutRef.current) {
        clearTimeout(revealingTimeoutRef.current);
      }
    };
  }, [game?.status, game?.id, players, playSound]);

  // Cleanup timeouts on component unmount
  useEffect(() => {
    return () => {
      if (calculatingTimeoutRef.current) clearTimeout(calculatingTimeoutRef.current);
      if (revealingTimeoutRef.current) clearTimeout(revealingTimeoutRef.current);
      if (stuckGameTimeoutRef.current) clearTimeout(stuckGameTimeoutRef.current);
      if (stuckPhaseTimeoutRef.current) clearTimeout(stuckPhaseTimeoutRef.current);
    };
  }, []);

  // Failsafe: Reset stuck games after 30 seconds of inactivity in calculating/revealing state
  const stuckGameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (game?.status === 'calculating' || game?.status === 'revealing') {
      // Clear existing failsafe
      if (stuckGameTimeoutRef.current) {
        clearTimeout(stuckGameTimeoutRef.current);
      }
      
      // Set failsafe timeout - if game is still in these states after 30 seconds, force reset
      stuckGameTimeoutRef.current = setTimeout(async () => {
        console.warn('Failsafe triggered: Game stuck in', game.status, '- forcing reset');
        try {
          // Use the force_finish action to properly return bets
          await supabase.functions.invoke('lucky9-game', {
            body: { action: 'force_finish', gameId: game.id, tableId }
          });
          
          setTimeout(() => {
            resetRound();
            processedGameIds.current.clear();
          }, 500);
        } catch (err) {
          console.error('Failsafe reset error:', err);
        }
      }, 30000);
    } else {
      // Clear failsafe if game is no longer in problematic state
      if (stuckGameTimeoutRef.current) {
        clearTimeout(stuckGameTimeoutRef.current);
        stuckGameTimeoutRef.current = null;
      }
    }
    
    return () => {
      if (stuckGameTimeoutRef.current) {
        clearTimeout(stuckGameTimeoutRef.current);
      }
    };
  }, [game?.status, game?.id, tableId]);

  // Additional failsafe: Check for stuck games in any phase (betting, player_turns, banker_turn)
  const stuckPhaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (game?.status === 'betting' || game?.status === 'player_turns' || game?.status === 'banker_turn') {
      // Clear existing timeout
      if (stuckPhaseTimeoutRef.current) {
        clearTimeout(stuckPhaseTimeoutRef.current);
      }
      
      // Set failsafe - if game is stuck in these phases for 2 minutes, force finish
      stuckPhaseTimeoutRef.current = setTimeout(async () => {
        console.warn('Phase failsafe triggered: Game stuck in', game.status, 'for 2 minutes');
        try {
          await supabase.functions.invoke('lucky9-game', {
            body: { action: 'force_finish', gameId: game.id, tableId }
          });
          
          setTimeout(() => {
            resetRound();
            processedGameIds.current.clear();
          }, 500);
        } catch (err) {
          console.error('Phase failsafe error:', err);
        }
      }, 120000); // 2 minutes
    } else {
      if (stuckPhaseTimeoutRef.current) {
        clearTimeout(stuckPhaseTimeoutRef.current);
        stuckPhaseTimeoutRef.current = null;
      }
    }
    
    return () => {
      if (stuckPhaseTimeoutRef.current) {
        clearTimeout(stuckPhaseTimeoutRef.current);
      }
    };
  }, [game?.status, game?.id, tableId]);

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
  
  // Banker can start betting only when there are at least one non-banker player and no active game
  const hasActivePlayers = nonBankerPlayers.filter(p => p.isActive && p.stack > 0).length >= 1;
  const canStartBetting = !game && myPlayer?.isBanker && hasActivePlayers;
  
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
      <Lucky9RoleDialog open={showRoleDialog} hasBanker={hasBanker} onSelectRole={joinTable} onCancel={() => navigate('/lucky9')} forceSpectator={forceSpectatorMode} forceSpectatorReason={forceSpectatorReason} />

      {/* Compact header for mobile */}
      <header className="border-b border-green-500/30 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="flex justify-between items-center px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={leaveTable} 
              className="h-7 w-7"
              disabled={!myPlayer?.isBanker && callTimeRemaining !== null && callTimeRemaining > 0}
              title={!myPlayer?.isBanker && callTimeRemaining ? "Cannot leave during Call Time" : undefined}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div>
              <h1 className="text-xs font-bold text-green-400">{table.name}</h1>
              <p className="text-[9px] text-muted-foreground">₱{table.minBet} - ₱{table.maxBet}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Call Time indicator */}
            {callTimeRemaining !== null && callTimeRemaining > 0 && (
              <div className="flex items-center gap-1 bg-red-900/50 px-2 py-1 rounded-lg border border-red-500/50 animate-pulse">
                <Clock className="h-3 w-3 text-red-400" />
                <span className="text-xs font-bold text-red-400">
                  {Math.floor(callTimeRemaining / 60)}:{(callTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            
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
          isSpectator={isSpectator}
          isAdmin={profile?.isAdmin}
          onAcceptBet={handleAcceptBet}
          onRejectBet={handleRejectBet}
          onKickPlayer={handleKickPlayer}
          isProcessing={isProcessing}
          onCardReveal={handleCardReveal}
          playerEmojis={playerEmojis}
          playerDecisions={playerDecisions}
          isDealing={isDealing}
          isShowdown={game?.status === 'finished' || game?.status === 'revealing'}
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
          targetPosition={hiritTargetPosition}
          onComplete={() => setShowHiritAnimation(false)}
        />

        {/* Chip animations for win/lose */}
        <Lucky9ChipAnimation
          animations={chipAnimations}
          onComplete={clearAnimations}
        />

        {/* Banker controls - positioned inside the table area to avoid overlap */}
        {hasActiveBanker && (canStartBetting || canDealCards) && (
          <div className="absolute left-1/2 top-[35%] -translate-x-1/2 -translate-y-1/2 z-30 flex justify-center gap-2">
            {canStartBetting && (
              <Button 
                onClick={startBetting} 
                disabled={isProcessing} 
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 px-4 py-2 text-sm font-bold rounded-xl shadow-lg shadow-green-500/30"
              >
                <Play className="h-4 w-4 mr-1.5" />
                Start Betting
              </Button>
            )}
            {canDealCards && (
              <Button 
                onClick={startRound} 
                disabled={isProcessing} 
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-4 py-2 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/30"
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
