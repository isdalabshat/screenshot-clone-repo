import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Card['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, tableId, gameId, actionType, amount } = await req.json();
    console.log(`Action: ${action}, TableId: ${tableId}, UserId: ${user.id}`);

    if (action === 'start_hand') {
      // Get active players
      const { data: playersData, error: playersError } = await supabase
        .from('table_players')
        .select('*')
        .eq('table_id', tableId)
        .eq('is_active', true);

      if (playersError || !playersData || playersData.length < 2) {
        return new Response(JSON.stringify({ error: 'Need at least 2 players' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get table info
      const { data: tableData } = await supabase
        .from('poker_tables')
        .select('*')
        .eq('id', tableId)
        .single();

      if (!tableData) {
        return new Response(JSON.stringify({ error: 'Table not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get current game to determine new dealer position
      const { data: currentGame } = await supabase
        .from('games')
        .select('dealer_position')
        .eq('table_id', tableId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const sortedPlayers = [...playersData].sort((a, b) => a.position - b.position);
      const numPlayers = sortedPlayers.length;

      // Determine new dealer position
      let newDealerPosition: number;
      if (currentGame) {
        const prevDealerIdx = sortedPlayers.findIndex(p => p.position === currentGame.dealer_position);
        const nextIdx = prevDealerIdx === -1 ? 0 : (prevDealerIdx + 1) % numPlayers;
        newDealerPosition = sortedPlayers[nextIdx].position;
      } else {
        newDealerPosition = sortedPlayers[0].position;
      }

      const dealerIdx = sortedPlayers.findIndex(p => p.position === newDealerPosition);
      
      // HEADS-UP LOGIC: In heads-up (2 players), dealer is SB and acts first preflop
      // In 3+ players, normal positions apply
      let sbIdx: number, bbIdx: number, firstToActIdx: number;
      
      if (numPlayers === 2) {
        // Heads-up: Dealer is SB, other player is BB
        sbIdx = dealerIdx;
        bbIdx = (dealerIdx + 1) % numPlayers;
        // Preflop: SB (dealer) acts first
        firstToActIdx = sbIdx;
      } else {
        // Standard: SB is left of dealer, BB is left of SB
        sbIdx = (dealerIdx + 1) % numPlayers;
        bbIdx = (dealerIdx + 2) % numPlayers;
        // Preflop: UTG (left of BB) acts first
        firstToActIdx = (bbIdx + 1) % numPlayers;
      }

      const firstToActPosition = sortedPlayers[firstToActIdx].position;

      // Create and shuffle deck
      const deck = shuffleDeck(createDeck());
      let deckIndex = 0;

      // Deal hole cards to each player
      const playerCards: Record<string, string[]> = {};
      for (const player of sortedPlayers) {
        const holeCards = [
          cardToString(deck[deckIndex++]),
          cardToString(deck[deckIndex++])
        ];
        playerCards[player.user_id] = holeCards;

        // Update player with their hole cards
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

      // Deal community cards (all 5, hidden until revealed by game status)
      const communityCards = [];
      for (let i = 0; i < 5; i++) {
        communityCards.push(cardToString(deck[deckIndex++]));
      }

      // Post blinds
      const sbPlayer = sortedPlayers[sbIdx];
      const bbPlayer = sortedPlayers[bbIdx];
      let potTotal = 0;

      const sbAmount = Math.min(tableData.small_blind, sbPlayer.stack);
      await supabase
        .from('table_players')
        .update({
          stack: sbPlayer.stack - sbAmount,
          current_bet: sbAmount,
          is_all_in: sbPlayer.stack <= tableData.small_blind
        })
        .eq('id', sbPlayer.id);
      potTotal += sbAmount;

      const bbAmount = Math.min(tableData.big_blind, bbPlayer.stack);
      await supabase
        .from('table_players')
        .update({
          stack: bbPlayer.stack - bbAmount,
          current_bet: bbAmount,
          is_all_in: bbPlayer.stack <= tableData.big_blind
        })
        .eq('id', bbPlayer.id);
      potTotal += bbAmount;

      // Create new game with turn_expires_at
      const turnExpiresAt = new Date(Date.now() + 30000).toISOString();
      
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          table_id: tableId,
          status: 'preflop',
          dealer_position: newDealerPosition,
          current_player_position: firstToActPosition,
          current_bet: tableData.big_blind,
          pot: potTotal,
          community_cards: communityCards,
          turn_expires_at: turnExpiresAt
        })
        .select()
        .single();

      if (gameError) {
        console.error('Failed to create game:', gameError);
        return new Response(JSON.stringify({ error: 'Failed to create game' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Return only the requesting user's cards
      return new Response(JSON.stringify({
        success: true,
        gameId: newGame.id,
        yourCards: playerCards[user.id] || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_my_cards') {
      // Get the current user's hole cards only
      const { data: playerData } = await supabase
        .from('table_players')
        .select('hole_cards')
        .eq('table_id', tableId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      return new Response(JSON.stringify({
        cards: playerData?.hole_cards || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'perform_action') {
      // Get current game
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (!game) {
        return new Response(JSON.stringify({ error: 'Game not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get current player
      const { data: currentPlayer } = await supabase
        .from('table_players')
        .select('*')
        .eq('table_id', tableId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!currentPlayer || currentPlayer.position !== game.current_player_position) {
        return new Response(JSON.stringify({ error: 'Not your turn' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get table
      const { data: tableData } = await supabase
        .from('poker_tables')
        .select('*')
        .eq('id', tableId)
        .single();

      if (!tableData) {
        return new Response(JSON.stringify({ error: 'Table not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let newStack = currentPlayer.stack;
      let newBet = currentPlayer.current_bet;
      let newPot = game.pot;
      let newCurrentBet = game.current_bet;
      let isFolded = false;
      let isAllIn = false;

      switch (actionType) {
        case 'fold':
          isFolded = true;
          break;
        case 'check':
          if (game.current_bet > currentPlayer.current_bet) {
            return new Response(JSON.stringify({ error: 'Cannot check, must call or raise' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          break;
        case 'call': {
          const callAmount = Math.min(game.current_bet - currentPlayer.current_bet, currentPlayer.stack);
          newStack -= callAmount;
          newBet += callAmount;
          newPot += callAmount;
          if (newStack === 0) isAllIn = true;
          break;
        }
        case 'bet':
        case 'raise': {
          const betAmount = amount || game.current_bet * 2;
          const totalBet = betAmount - currentPlayer.current_bet;
          if (totalBet > currentPlayer.stack) {
            return new Response(JSON.stringify({ error: 'Not enough chips' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
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
          game_id: game.id,
          user_id: user.id,
          action_type: actionType,
          amount: amount || 0,
          round: game.status
        });

      // Get all active players
      const { data: allPlayers } = await supabase
        .from('table_players')
        .select('*')
        .eq('table_id', tableId)
        .eq('is_active', true);

      if (!allPlayers) {
        return new Response(JSON.stringify({ error: 'Failed to get players' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const activePlayers = allPlayers.filter(p => !p.is_folded);
      const sortedPlayers = [...allPlayers].sort((a, b) => a.position - b.position);
      const numPlayers = sortedPlayers.filter(p => !p.is_folded).length;

      // Check if only one player left
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        await supabase
          .from('games')
          .update({ status: 'complete', pot: 0, turn_expires_at: null })
          .eq('id', game.id);

        await supabase
          .from('table_players')
          .update({ stack: winner.stack + newPot, current_bet: 0 })
          .eq('id', winner.id);

        return new Response(JSON.stringify({
          success: true,
          status: 'complete',
          winner: winner.user_id,
          pot: newPot
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find next player who hasn't acted or needs to act
      const playersNeedingToAct = activePlayers.filter(p =>
        !p.is_all_in && (p.current_bet < newCurrentBet || (p.id === currentPlayer.id && isFolded))
      );

      // Check if betting round is complete
      const sortedActivePlayers = sortedPlayers.filter(p => !p.is_folded && !p.is_all_in);
      const allBetsEqual = activePlayers.every(p =>
        p.is_folded || p.is_all_in || (p.id === currentPlayer.id ? newBet : p.current_bet) === newCurrentBet
      );

      // Get dealer index for determining first to act in new round
      const dealerIdx = sortedPlayers.findIndex(p => p.position === game.dealer_position);

      if (allBetsEqual && sortedActivePlayers.length > 0) {
        // Move to next round
        const roundOrder = ['preflop', 'flop', 'turn', 'river', 'showdown'];
        const currentIdx = roundOrder.indexOf(game.status);
        const nextRound = roundOrder[currentIdx + 1] || 'showdown';

        // Reset bets
        for (const p of allPlayers) {
          if (!p.is_folded) {
            await supabase
              .from('table_players')
              .update({ current_bet: 0 })
              .eq('id', p.id);
          }
        }

        if (nextRound === 'showdown') {
          // Showdown - determine winner (simplified: split pot)
          const activeAtShowdown = allPlayers.filter(p => !p.is_folded);
          const winAmount = Math.floor(newPot / activeAtShowdown.length);
          
          for (const winner of activeAtShowdown) {
            await supabase
              .from('table_players')
              .update({ stack: winner.stack + winAmount })
              .eq('id', winner.id);
          }

          await supabase
            .from('games')
            .update({
              status: 'showdown',
              pot: 0,
              current_bet: 0,
              current_player_position: null,
              turn_expires_at: null
            })
            .eq('id', game.id);

          return new Response(JSON.stringify({
            success: true,
            status: 'showdown',
            pot: newPot
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // Find first player after dealer for new betting round
          // In heads-up post-flop, BB acts first
          let nextPosition: number | null = null;
          const activeNonAllIn = sortedPlayers.filter(p => !p.is_folded && !p.is_all_in);
          
          if (activeNonAllIn.length > 0) {
            if (numPlayers === 2) {
              // Heads-up post-flop: BB acts first (opposite of dealer)
              const bbIdx = (dealerIdx + 1) % sortedPlayers.length;
              const bbPlayer = sortedPlayers[bbIdx];
              if (!bbPlayer.is_folded && !bbPlayer.is_all_in) {
                nextPosition = bbPlayer.position;
              } else {
                nextPosition = activeNonAllIn[0].position;
              }
            } else {
              // Find first active player after dealer
              for (let i = 1; i <= sortedPlayers.length; i++) {
                const idx = (dealerIdx + i) % sortedPlayers.length;
                const p = sortedPlayers[idx];
                if (!p.is_folded && !p.is_all_in) {
                  nextPosition = p.position;
                  break;
                }
              }
            }
          }

          const turnExpiresAt = nextPosition !== null ? new Date(Date.now() + 30000).toISOString() : null;

          await supabase
            .from('games')
            .update({
              status: nextRound,
              pot: newPot,
              current_bet: 0,
              current_player_position: nextPosition,
              turn_expires_at: turnExpiresAt
            })
            .eq('id', game.id);

          return new Response(JSON.stringify({
            success: true,
            status: nextRound,
            nextPlayer: nextPosition
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Find next player to act
      const currentPlayerIdx = sortedPlayers.findIndex(p => p.position === currentPlayer.position);
      let nextPosition: number | null = null;

      for (let i = 1; i <= sortedPlayers.length; i++) {
        const idx = (currentPlayerIdx + i) % sortedPlayers.length;
        const p = sortedPlayers[idx];
        if (!p.is_folded && !p.is_all_in && (p.current_bet < newCurrentBet || p.position === currentPlayer.position)) {
          if (p.id !== currentPlayer.id) {
            nextPosition = p.position;
            break;
          }
        }
      }

      const turnExpiresAt = nextPosition !== null ? new Date(Date.now() + 30000).toISOString() : null;

      await supabase
        .from('games')
        .update({
          pot: newPot,
          current_bet: newCurrentBet,
          current_player_position: nextPosition,
          turn_expires_at: turnExpiresAt
        })
        .eq('id', game.id);

      return new Response(JSON.stringify({
        success: true,
        nextPlayer: nextPosition
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'auto_fold') {
      // Auto-fold a player who timed out (called by timer)
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (!game || !game.turn_expires_at) {
        return new Response(JSON.stringify({ error: 'No active turn' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if turn has actually expired
      if (new Date(game.turn_expires_at) > new Date()) {
        return new Response(JSON.stringify({ error: 'Turn not expired yet' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get the player whose turn it is
      const { data: timedOutPlayer } = await supabase
        .from('table_players')
        .select('*')
        .eq('table_id', tableId)
        .eq('position', game.current_player_position)
        .eq('is_active', true)
        .maybeSingle();

      if (!timedOutPlayer) {
        return new Response(JSON.stringify({ error: 'Player not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fold the player
      await supabase
        .from('table_players')
        .update({ is_folded: true })
        .eq('id', timedOutPlayer.id);

      // Record the auto-fold action
      await supabase
        .from('game_actions')
        .insert({
          game_id: game.id,
          user_id: timedOutPlayer.user_id,
          action_type: 'fold',
          amount: 0,
          round: game.status
        });

      // Continue game logic (similar to perform_action fold)
      const { data: allPlayers } = await supabase
        .from('table_players')
        .select('*')
        .eq('table_id', tableId)
        .eq('is_active', true);

      if (!allPlayers) {
        return new Response(JSON.stringify({ error: 'Failed to get players' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const activePlayers = allPlayers.filter(p => p.id !== timedOutPlayer.id && !p.is_folded);

      // Check if only one player left
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        await supabase
          .from('games')
          .update({ status: 'complete', pot: 0, turn_expires_at: null })
          .eq('id', game.id);

        await supabase
          .from('table_players')
          .update({ stack: winner.stack + game.pot, current_bet: 0 })
          .eq('id', winner.id);

        return new Response(JSON.stringify({
          success: true,
          status: 'complete',
          autoFolded: timedOutPlayer.user_id,
          winner: winner.user_id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find next player
      const sortedPlayers = [...allPlayers].sort((a, b) => a.position - b.position);
      const currentIdx = sortedPlayers.findIndex(p => p.position === timedOutPlayer.position);
      let nextPosition: number | null = null;

      for (let i = 1; i <= sortedPlayers.length; i++) {
        const idx = (currentIdx + i) % sortedPlayers.length;
        const p = sortedPlayers[idx];
        if (!p.is_folded && !p.is_all_in && p.id !== timedOutPlayer.id) {
          nextPosition = p.position;
          break;
        }
      }

      const turnExpiresAt = nextPosition !== null ? new Date(Date.now() + 30000).toISOString() : null;

      await supabase
        .from('games')
        .update({
          current_player_position: nextPosition,
          turn_expires_at: turnExpiresAt
        })
        .eq('id', game.id);

      return new Response(JSON.stringify({
        success: true,
        autoFolded: timedOutPlayer.user_id,
        nextPlayer: nextPosition
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
