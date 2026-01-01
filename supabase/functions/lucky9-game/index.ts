import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lucky 9 Deck - Only Ace through 10
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function createDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

function shuffleDeck(deck: string[]): string[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCardValue(card: string): number {
  const rank = card.slice(0, -1);
  if (rank === 'A') return 1;
  if (rank === '10') return 0;
  return parseInt(rank, 10);
}

function calculateLucky9Value(cards: string[]): number {
  const total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
  return total % 10;
}

function isNatural9(cards: string[]): boolean {
  return cards.length === 2 && calculateLucky9Value(cards) === 9;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, tableId, playerId, amount, userId, role, gameId, actionType } = body;
    console.log('Lucky9 action:', action, 'tableId:', tableId, 'playerId:', playerId, 'actionType:', actionType);

    switch (action) {
      case 'join_table': {
        // Get table info for min bet check
        const { data: tableInfo } = await supabase
          .from('lucky9_tables')
          .select('min_bet')
          .eq('id', tableId)
          .single();

        if (!tableInfo) {
          return new Response(JSON.stringify({ error: 'Table not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, chips')
          .eq('user_id', userId)
          .single();

        if (!profile) {
          return new Response(JSON.stringify({ error: 'Profile not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if balance is >= minimum bet
        if (profile.chips < tableInfo.min_bet) {
          return new Response(JSON.stringify({ 
            error: `Insufficient balance. Minimum required: ₱${tableInfo.min_bet}` 
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if there's already a banker
        const { data: existingBanker } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('table_id', tableId)
          .eq('is_active', true)
          .eq('is_banker', true)
          .maybeSingle();

        if (role === 'banker' && existingBanker) {
          return new Response(JSON.stringify({ error: 'A banker already exists at this table' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Find next available position
        const { data: currentPlayers } = await supabase
          .from('lucky9_players')
          .select('position')
          .eq('table_id', tableId)
          .eq('is_active', true);

        const usedPositions = new Set(currentPlayers?.map(p => p.position) || []);
        let position = role === 'banker' ? 0 : 1;
        if (role !== 'banker') {
          while (usedPositions.has(position)) position++;
        }

        // Insert player
        const { data: newPlayer, error } = await supabase
          .from('lucky9_players')
          .insert({
            table_id: tableId,
            user_id: userId,
            username: profile.username,
            position,
            stack: profile.chips,
            is_banker: role === 'banker'
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, player: newPlayer }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'place_bet': {
        // Get player and validate bet
        const { data: player } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (player.is_banker) {
          return new Response(JSON.stringify({ error: 'Banker cannot place bets' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (player.stack < amount) {
          return new Response(JSON.stringify({ error: 'Insufficient chips' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update player bet - bet_accepted is null (pending)
        await supabase
          .from('lucky9_players')
          .update({ 
            current_bet: amount, 
            stack: player.stack - amount,
            bet_accepted: null
          })
          .eq('id', playerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'accept_bet': {
        // Banker accepts a player's bet
        const { data: banker } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('table_id', tableId)
          .eq('user_id', userId)
          .eq('is_banker', true)
          .single();

        if (!banker) {
          return new Response(JSON.stringify({ error: 'Only banker can accept bets' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get the player's bet amount
        const { data: player } = await supabase
          .from('lucky9_players')
          .select('current_bet')
          .eq('id', playerId)
          .single();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get all currently accepted bets to calculate total exposure
        const { data: acceptedBets } = await supabase
          .from('lucky9_players')
          .select('current_bet')
          .eq('table_id', tableId)
          .eq('is_active', true)
          .eq('is_banker', false)
          .eq('bet_accepted', true);

        const totalAcceptedBets = (acceptedBets || []).reduce((sum, p) => sum + (p.current_bet || 0), 0);
        const newTotalExposure = totalAcceptedBets + player.current_bet;

        // Check if banker has enough balance to cover ALL accepted bets (worst case: all players win)
        if (banker.stack < newTotalExposure) {
          return new Response(JSON.stringify({ 
            error: `Cannot accept bet. Your balance (₱${banker.stack.toLocaleString()}) must cover all accepted bets (₱${newTotalExposure.toLocaleString()}) if all players win.` 
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await supabase
          .from('lucky9_players')
          .update({ bet_accepted: true })
          .eq('id', playerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'reject_bet': {
        // Banker rejects a player's bet - return their chips
        const { data: banker } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('table_id', tableId)
          .eq('user_id', userId)
          .eq('is_banker', true)
          .single();

        if (!banker) {
          return new Response(JSON.stringify({ error: 'Only banker can reject bets' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get player
        const { data: player } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (player) {
          // Return the bet to player's stack
          await supabase
            .from('lucky9_players')
            .update({ 
              bet_accepted: false,
              stack: player.stack + player.current_bet,
              current_bet: 0
            })
            .eq('id', playerId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'betting_timer_end': {
        // When betting timer ends, only accepted bets continue
        // If no accepted bets, all players and banker auto leave
        console.log('Betting timer ended for table:', tableId);

        // Get current game
        const { data: game } = await supabase
          .from('lucky9_games')
          .select('*')
          .eq('table_id', tableId)
          .eq('status', 'betting')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!game) {
          return new Response(JSON.stringify({ error: 'No active betting game' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get players with accepted bets
        const { data: acceptedPlayers } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', game.id)
          .eq('is_active', true)
          .eq('is_banker', false)
          .eq('bet_accepted', true);

        // Get players with pending bets (not accepted) - return their chips
        const { data: pendingPlayers } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', game.id)
          .eq('is_active', true)
          .eq('is_banker', false)
          .is('bet_accepted', null)
          .gt('current_bet', 0);

        // Return chips to pending bet players
        for (const player of pendingPlayers || []) {
          await supabase
            .from('lucky9_players')
            .update({ 
              stack: player.stack + player.current_bet,
              current_bet: 0,
              bet_accepted: false
            })
            .eq('id', player.id);
        }

        if (!acceptedPlayers || acceptedPlayers.length === 0) {
          // No accepted bets - everyone auto leaves
          console.log('No accepted bets - auto leaving all players');

          // Get all players including banker
          const { data: allPlayers } = await supabase
            .from('lucky9_players')
            .select('*')
            .eq('table_id', tableId)
            .eq('is_active', true);

          // Return chips to profiles and delete players
          for (const player of allPlayers || []) {
            // Return chips to profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('chips')
              .eq('user_id', player.user_id)
              .single();

            if (profile) {
              await supabase
                .from('profiles')
                .update({ chips: profile.chips + player.stack })
                .eq('user_id', player.user_id);
            }

            // Delete player
            await supabase
              .from('lucky9_players')
              .delete()
              .eq('id', player.id);
          }

          // Mark game as finished
          await supabase
            .from('lucky9_games')
            .update({ status: 'finished' })
            .eq('id', game.id);

          return new Response(JSON.stringify({ success: true, allLeft: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // There are accepted bets - proceed to dealing
        return new Response(JSON.stringify({ success: true, canDeal: true, acceptedCount: acceptedPlayers.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'start_betting': {
        // Get table for timer settings
        const { data: table } = await supabase
          .from('lucky9_tables')
          .select('bet_timer_seconds')
          .eq('id', tableId)
          .single();

        const timerSeconds = table?.bet_timer_seconds || 30;
        const bettingEndsAt = new Date(Date.now() + timerSeconds * 1000).toISOString();

        // Get banker
        const { data: banker } = await supabase
          .from('lucky9_players')
          .select('id')
          .eq('table_id', tableId)
          .eq('is_active', true)
          .eq('is_banker', true)
          .single();

        if (!banker) {
          return new Response(JSON.stringify({ error: 'No banker at the table' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create game with betting timer
        const { data: game, error } = await supabase
          .from('lucky9_games')
          .insert({
            table_id: tableId,
            status: 'betting',
            betting_ends_at: bettingEndsAt,
            banker_id: banker.id,
            dealer_cards: [],
            dealer_hidden_card: null
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Link players to game and reset their bet status for new round
        await supabase
          .from('lucky9_players')
          .update({ 
            game_id: game.id,
            current_bet: 0,
            bet_accepted: null,
            cards: [],
            has_acted: false,
            has_stood: false,
            is_natural: false,
            result: null,
            winnings: 0
          })
          .eq('table_id', tableId)
          .eq('is_active', true);

        return new Response(JSON.stringify({ success: true, gameId: game.id, bettingEndsAt }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'start_round': {
        // Get game
        const { data: game } = await supabase
          .from('lucky9_games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (!game) {
          return new Response(JSON.stringify({ error: 'Game not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get all active players with ACCEPTED bets only
        const { data: players } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false)
          .eq('bet_accepted', true)
          .gt('current_bet', 0)
          .order('position');

        // Get banker
        const { data: banker } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('id', game.banker_id)
          .single();

        if (!banker) {
          return new Response(JSON.stringify({ error: 'Banker not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!players || players.length === 0) {
          return new Response(JSON.stringify({ error: 'No players with accepted bets' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create and shuffle deck
        const deck = shuffleDeck(createDeck());
        let deckIndex = 0;

        // Deal 2 cards to each player with accepted bets
        let anyPlayerNatural = false;
        for (const player of players) {
          const cards = [deck[deckIndex++], deck[deckIndex++]];
          const natural = isNatural9(cards);
          if (natural) anyPlayerNatural = true;
          
          await supabase
            .from('lucky9_players')
            .update({ 
              cards, 
              is_natural: natural,
              has_acted: natural,
              has_stood: natural
            })
            .eq('id', player.id);
        }

        // Deal banker cards
        const bankerVisibleCard = deck[deckIndex++];
        const bankerHiddenCard = deck[deckIndex++];
        const bankerCards = [bankerVisibleCard, bankerHiddenCard];
        const bankerNatural = isNatural9(bankerCards);

        await supabase
          .from('lucky9_players')
          .update({ 
            cards: bankerCards,
            is_natural: bankerNatural,
            has_acted: bankerNatural,
            has_stood: bankerNatural
          })
          .eq('id', banker.id);

        // Store remaining deck
        const remainingDeck = deck.slice(deckIndex);

        // Check if anyone has natural 9 - if so, go directly to showdown
        if (bankerNatural || anyPlayerNatural) {
          console.log('Natural 9 detected! Going straight to showdown');
          
          // Update game to showdown immediately
          await supabase
            .from('lucky9_games')
            .update({
              status: 'showdown',
              dealer_cards: bankerCards,
              dealer_hidden_card: null,
              current_player_position: null,
              betting_ends_at: null
            })
            .eq('id', gameId);

          // Calculate results immediately
          const bankerValue = calculateLucky9Value(bankerCards);
          let bankerTotalWin = 0;
          let bankerTotalLoss = 0;

          for (const player of players) {
            const playerCards = [deck[(players.indexOf(player)) * 2], deck[(players.indexOf(player)) * 2 + 1]];
            const playerValue = calculateLucky9Value(playerCards);
            const playerIsNatural = isNatural9(playerCards);
            
            // Get player's current bet
            const { data: currentPlayer } = await supabase
              .from('lucky9_players')
              .select('current_bet, stack')
              .eq('id', player.id)
              .single();
            
            const currentBet = currentPlayer?.current_bet || 0;
            const currentStack = currentPlayer?.stack || 0;
            
            let result: string;
            let winnings = 0;

            // Natural 9 wins logic
            if (playerIsNatural && !bankerNatural) {
              result = 'natural_win';
              winnings = currentBet * 3;
              bankerTotalLoss += currentBet * 2;
            } else if (bankerNatural && !playerIsNatural) {
              result = 'lose';
              winnings = 0;
              bankerTotalWin += currentBet;
            } else if (playerValue === bankerValue) {
              if (playerIsNatural && !bankerNatural) {
                result = 'natural_win';
                winnings = currentBet * 3;
                bankerTotalLoss += currentBet * 2;
              } else if (bankerNatural && !playerIsNatural) {
                result = 'lose';
                winnings = 0;
                bankerTotalWin += currentBet;
              } else {
                result = 'push';
                winnings = currentBet;
              }
            } else if (playerValue > bankerValue) {
              result = 'win';
              winnings = currentBet * 2;
              bankerTotalLoss += currentBet;
            } else {
              result = 'lose';
              winnings = 0;
              bankerTotalWin += currentBet;
            }

            await supabase
              .from('lucky9_players')
              .update({ 
                result,
                winnings,
                stack: currentStack + winnings,
                has_acted: true,
                has_stood: true
              })
              .eq('id', player.id);
          }

          // Update banker
          const newBankerStack = banker.stack + bankerTotalWin - bankerTotalLoss;
          await supabase
            .from('lucky9_players')
            .update({ 
              stack: newBankerStack,
              result: bankerTotalWin > bankerTotalLoss ? 'win' : bankerTotalWin < bankerTotalLoss ? 'lose' : 'push',
              winnings: bankerTotalWin - bankerTotalLoss,
              has_acted: true,
              has_stood: true
            })
            .eq('id', banker.id);

          // Mark game as finished
          await supabase
            .from('lucky9_games')
            .update({ status: 'finished' })
            .eq('id', gameId);

          return new Response(JSON.stringify({ 
            success: true, 
            gameId,
            remainingDeck,
            naturalWin: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Find first player to act (skip naturals)
        const firstPlayer = players.find(p => {
          const idx = players.indexOf(p);
          const playerCards = [deck[idx * 2], deck[idx * 2 + 1]];
          return !isNatural9(playerCards);
        });

        // Update game - normal flow
        await supabase
          .from('lucky9_games')
          .update({
            status: 'player_turns',
            dealer_cards: [bankerVisibleCard],
            dealer_hidden_card: bankerHiddenCard,
            current_player_position: firstPlayer?.position || null,
            betting_ends_at: null
          })
          .eq('id', gameId);

        return new Response(JSON.stringify({ 
          success: true, 
          gameId,
          remainingDeck 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'player_action': {
        console.log('Player action:', actionType, 'playerId:', playerId, 'gameId:', gameId);

        if (!playerId || !gameId) {
          return new Response(JSON.stringify({ error: 'Missing playerId or gameId' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: player } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (player.has_acted) {
          return new Response(JSON.stringify({ error: 'Player has already acted' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let updatedCards = [...(player.cards || [])];

        if (actionType === 'draw') {
          if (updatedCards.length >= 3) {
            return new Response(JSON.stringify({ error: 'Maximum 3 cards reached' }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Create a fresh deck and draw a random card
          const usedCards = new Set(updatedCards);
          
          // Get all player cards in the game to avoid duplicates
          const { data: allPlayers } = await supabase
            .from('lucky9_players')
            .select('cards')
            .eq('game_id', gameId)
            .eq('is_active', true);
          
          for (const p of allPlayers || []) {
            for (const c of p.cards || []) {
              usedCards.add(c);
            }
          }
          
          const fullDeck = createDeck();
          const availableCards = fullDeck.filter(c => !usedCards.has(c));
          
          if (availableCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableCards.length);
            const newCard = availableCards[randomIndex];
            updatedCards.push(newCard);
            console.log('Drew card:', newCard, 'New hand:', updatedCards);
          }
        }

        await supabase
          .from('lucky9_players')
          .update({ 
            cards: updatedCards,
            has_acted: true,
            has_stood: true
          })
          .eq('id', playerId);

        // Check if all non-banker players have acted
        const { data: allPlayers } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false)
          .eq('bet_accepted', true)
          .order('position');

        const allActed = allPlayers?.every(p => p.has_acted || p.id === playerId);
        const currentPos = player.position;
        const nextPlayer = allPlayers?.find(p => p.position > currentPos && !p.has_acted && p.id !== playerId);

        if (allActed || !nextPlayer) {
          await supabase
            .from('lucky9_games')
            .update({ 
              status: 'banker_turn',
              current_player_position: null
            })
            .eq('id', gameId);
        } else {
          await supabase
            .from('lucky9_games')
            .update({ current_player_position: nextPlayer.position })
            .eq('id', gameId);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          cards: updatedCards
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'banker_action': {
        console.log('Banker action:', actionType, 'playerId:', playerId, 'gameId:', gameId);

        if (!playerId || !gameId) {
          return new Response(JSON.stringify({ error: 'Missing playerId or gameId' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: banker } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (!banker || !banker.is_banker) {
          return new Response(JSON.stringify({ error: 'Not a banker' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (banker.has_acted) {
          return new Response(JSON.stringify({ error: 'Banker has already acted' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let bankerCards = [...(banker.cards || [])];

        if (actionType === 'draw' && bankerCards.length < 3) {
          // Get all used cards
          const usedCards = new Set(bankerCards);
          
          const { data: allPlayers } = await supabase
            .from('lucky9_players')
            .select('cards')
            .eq('game_id', gameId)
            .eq('is_active', true);
          
          for (const p of allPlayers || []) {
            for (const c of p.cards || []) {
              usedCards.add(c);
            }
          }
          
          const fullDeck = createDeck();
          const availableCards = fullDeck.filter(c => !usedCards.has(c));
          
          if (availableCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableCards.length);
            const newCard = availableCards[randomIndex];
            bankerCards.push(newCard);
            console.log('Banker drew card:', newCard, 'New hand:', bankerCards);
          }
        }

        await supabase
          .from('lucky9_players')
          .update({ 
            cards: bankerCards,
            has_acted: true,
            has_stood: true
          })
          .eq('id', playerId);

        // Update game to 'calculating' first (1 sec delay before deciding winner)
        await supabase
          .from('lucky9_games')
          .update({ 
            dealer_cards: bankerCards,
            dealer_hidden_card: null,
            status: 'calculating'
          })
          .eq('id', gameId);

        // Calculate results - Natural 9 (before hirit) wins ties
        const bankerValue = calculateLucky9Value(bankerCards);
        const bankerIsNatural = banker.is_natural; // Had 9 with initial 2 cards

        // Get all players with accepted bets
        const { data: players } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false)
          .eq('bet_accepted', true);

        let bankerTotalWin = 0;
        let bankerTotalLoss = 0;

        for (const player of players || []) {
          const playerValue = calculateLucky9Value(player.cards || []);
          const playerIsNatural = player.is_natural; // Had 9 with initial 2 cards
          let result: string;
          let winnings = 0;

          // Case 1: Player has natural 9, banker doesn't - player wins with bonus
          if (playerIsNatural && !bankerIsNatural) {
            result = 'natural_win';
            winnings = player.current_bet * 3;
            bankerTotalLoss += player.current_bet * 2;
          } 
          // Case 2: Banker has natural 9, player doesn't - banker wins
          else if (bankerIsNatural && !playerIsNatural) {
            result = 'lose';
            winnings = 0;
            bankerTotalWin += player.current_bet;
          }
          // Case 3: Both have same value (tie scenarios)
          else if (playerValue === bankerValue) {
            // Tiebreaker: Natural 9 beats non-natural 9
            if (playerIsNatural && !bankerIsNatural) {
              // Player had natural 9, banker got 9 after hirit - player wins
              result = 'natural_win';
              winnings = player.current_bet * 3;
              bankerTotalLoss += player.current_bet * 2;
            } else if (bankerIsNatural && !playerIsNatural) {
              // Banker had natural 9, player got 9 after hirit - banker wins
              result = 'lose';
              winnings = 0;
              bankerTotalWin += player.current_bet;
            } else {
              // Both natural or both non-natural with same value - push
              result = 'push';
              winnings = player.current_bet;
            }
          }
          // Case 4: Player has higher value
          else if (playerValue > bankerValue) {
            result = 'win';
            winnings = player.current_bet * 2;
            bankerTotalLoss += player.current_bet;
          } 
          // Case 5: Banker has higher value
          else {
            result = 'lose';
            winnings = 0;
            bankerTotalWin += player.current_bet;
          }

          await supabase
            .from('lucky9_players')
            .update({ 
              result,
              winnings,
              stack: player.stack + winnings
            })
            .eq('id', player.id);
        }

        // Update banker stack
        const newBankerStack = banker.stack + bankerTotalWin - bankerTotalLoss;
        await supabase
          .from('lucky9_players')
          .update({ 
            stack: newBankerStack,
            result: bankerTotalWin > bankerTotalLoss ? 'win' : bankerTotalWin < bankerTotalLoss ? 'lose' : 'push',
            winnings: bankerTotalWin - bankerTotalLoss
          })
          .eq('id', banker.id);

        // Update game status to 'revealing' - cards are visible for 5 seconds before 'finished'
        await supabase
          .from('lucky9_games')
          .update({ status: 'revealing' })
          .eq('id', gameId);

        // Check for zero balance and auto-kick players/banker
        const kickedPlayers: string[] = [];

        // Check banker balance
        if (newBankerStack <= 0) {
          console.log('Banker has zero balance, auto-kicking');
          kickedPlayers.push(banker.user_id);
          
          // Return 0 chips and delete
          await supabase
            .from('lucky9_players')
            .delete()
            .eq('id', banker.id);
        }

        // Check all players
        for (const player of players || []) {
          const { data: updatedPlayer } = await supabase
            .from('lucky9_players')
            .select('stack, user_id')
            .eq('id', player.id)
            .single();

          if (updatedPlayer && updatedPlayer.stack <= 0) {
            console.log('Player has zero balance, auto-kicking:', updatedPlayer.user_id);
            kickedPlayers.push(updatedPlayer.user_id);
            
            await supabase
              .from('lucky9_players')
              .delete()
              .eq('id', player.id);
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          bankerCards,
          bankerValue,
          bankerIsNatural,
          kickedPlayers
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'reset_round': {
        // Reset all players for new round
        await supabase
          .from('lucky9_players')
          .update({ 
            cards: [],
            current_bet: 0,
            has_acted: false,
            has_stood: false,
            is_natural: false,
            result: null,
            winnings: 0,
            game_id: null,
            bet_accepted: null
          })
          .eq('table_id', tableId)
          .eq('is_active', true);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'banker_leave': {
        // When banker leaves mid-game, banker is marked as loss and all players win their bets
        console.log('Banker leaving table:', tableId);

        // Get active game
        const { data: currentGame } = await supabase
          .from('lucky9_games')
          .select('*')
          .eq('table_id', tableId)
          .neq('status', 'finished')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get banker before we process
        const { data: bankerPlayer } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('table_id', tableId)
          .eq('user_id', userId)
          .eq('is_banker', true)
          .single();

        if (currentGame && bankerPlayer) {
          // Mark banker as LOSS
          await supabase
            .from('lucky9_players')
            .update({ 
              result: 'lose',
              winnings: 0
            })
            .eq('id', bankerPlayer.id);

          // Get all players with accepted bets
          const { data: players } = await supabase
            .from('lucky9_players')
            .select('*')
            .eq('game_id', currentGame.id)
            .eq('is_active', true)
            .eq('is_banker', false)
            .eq('bet_accepted', true);

          // All players win - return their bet + winnings (2x bet)
          for (const player of players || []) {
            if (player.current_bet > 0) {
              const winnings = player.current_bet * 2;
              await supabase
                .from('lucky9_players')
                .update({ 
                  result: 'win',
                  winnings,
                  stack: player.stack + winnings
                })
                .eq('id', player.id);
            }
          }

          // Return pending bets
          const { data: pendingPlayers } = await supabase
            .from('lucky9_players')
            .select('*')
            .eq('game_id', currentGame.id)
            .eq('is_active', true)
            .eq('is_banker', false)
            .is('bet_accepted', null);

          for (const player of pendingPlayers || []) {
            if (player.current_bet > 0) {
              await supabase
                .from('lucky9_players')
                .update({ 
                  stack: player.stack + player.current_bet,
                  current_bet: 0
                })
                .eq('id', player.id);
            }
          }

          // Mark game as finished
          await supabase
            .from('lucky9_games')
            .update({ status: 'finished' })
            .eq('id', currentGame.id);
        }

        // Return banker chips to profile and delete (use already fetched bankerPlayer)

        if (bankerPlayer) {
          // Return chips to profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('chips')
            .eq('user_id', userId)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ chips: profile.chips + bankerPlayer.stack })
              .eq('user_id', userId);
          }

          // Delete the banker
          await supabase
            .from('lucky9_players')
            .delete()
            .eq('id', bankerPlayer.id);
        }

        return new Response(JSON.stringify({ success: true, bankerLeft: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'player_leave': {
        // When a player leaves mid-game, they are marked as loss and banker wins their bet
        console.log('Player leaving table:', tableId, 'userId:', userId);

        // Get the player
        const { data: player } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('table_id', tableId)
          .eq('user_id', userId)
          .eq('is_banker', false)
          .single();

        if (!player) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get active game
        const { data: currentGame } = await supabase
          .from('lucky9_games')
          .select('*')
          .eq('table_id', tableId)
          .neq('status', 'finished')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (currentGame && player.current_bet > 0 && player.bet_accepted === true) {
          // Mark player as LOSS before deleting (for history/display)
          await supabase
            .from('lucky9_players')
            .update({ 
              result: 'lose',
              winnings: 0
            })
            .eq('id', player.id);

          // Get the banker
          const { data: banker } = await supabase
            .from('lucky9_players')
            .select('*')
            .eq('id', currentGame.banker_id)
            .single();

          if (banker) {
            // Banker wins the player's bet
            await supabase
              .from('lucky9_players')
              .update({ 
                stack: banker.stack + player.current_bet,
                winnings: (banker.winnings || 0) + player.current_bet
              })
              .eq('id', banker.id);
          }

          // Check if this was the current player's turn - advance to next
          if (currentGame.current_player_position === player.position && currentGame.status === 'player_turns') {
            const { data: remainingPlayers } = await supabase
              .from('lucky9_players')
              .select('*')
              .eq('game_id', currentGame.id)
              .eq('is_active', true)
              .eq('is_banker', false)
              .eq('bet_accepted', true)
              .neq('id', player.id)
              .order('position');

            const nextPlayer = remainingPlayers?.find(p => p.position > player.position && !p.has_acted);
            
            if (nextPlayer) {
              await supabase
                .from('lucky9_games')
                .update({ current_player_position: nextPlayer.position })
                .eq('id', currentGame.id);
            } else {
              await supabase
                .from('lucky9_games')
                .update({ status: 'banker_turn', current_player_position: null })
                .eq('id', currentGame.id);
            }
          }
        }

        // Return remaining stack to profile (stack only, bet was forfeited)
        const { data: profile } = await supabase
          .from('profiles')
          .select('chips')
          .eq('user_id', userId)
          .single();

        if (profile && player.stack > 0) {
          await supabase
            .from('profiles')
            .update({ chips: profile.chips + player.stack })
            .eq('user_id', userId);
        }

        // Delete the player
        await supabase
          .from('lucky9_players')
          .delete()
          .eq('id', player.id);

        return new Response(JSON.stringify({ success: true, playerMarkedAsLoss: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    console.error('Lucky9 error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
