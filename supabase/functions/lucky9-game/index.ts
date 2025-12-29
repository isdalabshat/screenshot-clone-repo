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
    const { action, tableId, playerId, betAmount, userId, role } = body;
    console.log('Lucky9 action:', action, 'tableId:', tableId, 'playerId:', playerId);

    switch (action) {
      case 'join_table': {
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
        let position = role === 'banker' ? 0 : 1; // Banker gets position 0
        if (role !== 'banker') {
          while (usedPositions.has(position)) position++;
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

        if (player.stack < betAmount) {
          return new Response(JSON.stringify({ error: 'Insufficient chips' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update player bet
        await supabase
          .from('lucky9_players')
          .update({ 
            current_bet: betAmount, 
            stack: player.stack - betAmount 
          })
          .eq('id', playerId);

        return new Response(JSON.stringify({ success: true }), {
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

        // Link players to game
        await supabase
          .from('lucky9_players')
          .update({ game_id: game.id })
          .eq('table_id', tableId)
          .eq('is_active', true);

        return new Response(JSON.stringify({ success: true, gameId: game.id, bettingEndsAt }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'start_round': {
        const { gameId } = body;

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

        // Get all active players with bets (non-bankers)
        const { data: players } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false)
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
          return new Response(JSON.stringify({ error: 'No players with bets' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create and shuffle deck
        const deck = shuffleDeck(createDeck());
        let deckIndex = 0;

        // Deal 2 cards to each player
        for (const player of players) {
          const cards = [deck[deckIndex++], deck[deckIndex++]];
          const natural = isNatural9(cards);
          
          await supabase
            .from('lucky9_players')
            .update({ 
              cards, 
              is_natural: natural,
              has_acted: natural, // Natural 9 auto-stands
              has_stood: natural
            })
            .eq('id', player.id);
        }

        // Deal banker cards (2 cards, one hidden)
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

        // Find first player to act (skip naturals)
        const firstPlayer = players.find(p => {
          const playerCards = [deck[players.indexOf(p) * 2], deck[players.indexOf(p) * 2 + 1]];
          return !isNatural9(playerCards);
        });

        // Update game
        await supabase
          .from('lucky9_games')
          .update({
            status: 'player_turns',
            dealer_cards: [bankerVisibleCard], // Only visible card
            dealer_hidden_card: bankerHiddenCard,
            current_player_position: firstPlayer?.position || null,
            betting_ends_at: null
          })
          .eq('id', gameId);

        // Store remaining deck
        const remainingDeck = deck.slice(deckIndex);

        return new Response(JSON.stringify({ 
          success: true, 
          gameId,
          remainingDeck 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'player_action': {
        const { playerAction, gameId, remainingDeck } = body;

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

        if (player.cards && player.cards.length >= 3) {
          return new Response(JSON.stringify({ error: 'Maximum 3 cards reached' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let updatedCards = [...(player.cards || [])];
        let updatedDeck = [...(remainingDeck || [])];

        if (playerAction === 'draw') {
          const newCard = updatedDeck.shift();
          if (newCard) {
            updatedCards.push(newCard);
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
          .order('position');

        const allActed = allPlayers?.every(p => p.has_acted || p.id === playerId);
        
        // Find next player who hasn't acted
        const currentPos = player.position;
        const nextPlayer = allPlayers?.find(p => p.position > currentPos && !p.has_acted && p.id !== playerId);

        if (allActed || !nextPlayer) {
          // Move to banker turn
          await supabase
            .from('lucky9_games')
            .update({ 
              status: 'banker_turn',
              current_player_position: null
            })
            .eq('id', gameId);
        } else {
          // Update current player position
          await supabase
            .from('lucky9_games')
            .update({ current_player_position: nextPlayer.position })
            .eq('id', gameId);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          cards: updatedCards,
          remainingDeck: updatedDeck
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'banker_action': {
        const { playerAction, gameId, remainingDeck } = body;

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
        let updatedDeck = [...(remainingDeck || [])];

        if (playerAction === 'draw' && bankerCards.length < 3) {
          const newCard = updatedDeck.shift();
          if (newCard) {
            bankerCards.push(newCard);
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

        // Get game to update dealer cards display
        await supabase
          .from('lucky9_games')
          .update({ 
            dealer_cards: bankerCards,
            dealer_hidden_card: null,
            status: 'showdown'
          })
          .eq('id', gameId);

        // Calculate results
        const bankerValue = calculateLucky9Value(bankerCards);
        const bankerIsNatural = banker.is_natural;

        // Get all players
        const { data: players } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false);

        let bankerTotalWin = 0;
        let bankerTotalLoss = 0;

        for (const player of players || []) {
          const playerValue = calculateLucky9Value(player.cards || []);
          let result: string;
          let winnings = 0;

          if (player.is_natural && !bankerIsNatural) {
            result = 'natural_win';
            winnings = player.current_bet * 3;
            bankerTotalLoss += player.current_bet * 2;
          } else if (bankerIsNatural && !player.is_natural) {
            result = 'lose';
            winnings = 0;
            bankerTotalWin += player.current_bet;
          } else if (playerValue > bankerValue) {
            result = 'win';
            winnings = player.current_bet * 2;
            bankerTotalLoss += player.current_bet;
          } else if (playerValue < bankerValue) {
            result = 'lose';
            winnings = 0;
            bankerTotalWin += player.current_bet;
          } else {
            result = 'push';
            winnings = player.current_bet;
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

        // Update game status to finished
        await supabase
          .from('lucky9_games')
          .update({ status: 'finished' })
          .eq('id', gameId);

        return new Response(JSON.stringify({ 
          success: true, 
          bankerCards,
          bankerValue,
          bankerIsNatural
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
            game_id: null
          })
          .eq('table_id', tableId)
          .eq('is_active', true);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'banker_leave': {
        // When banker leaves mid-game, all players win their bets
        const { gameId } = body;
        console.log('Banker leaving game:', gameId);

        if (gameId) {
          // Get active game
          const { data: game } = await supabase
            .from('lucky9_games')
            .select('*')
            .eq('id', gameId)
            .single();

          if (game && game.status !== 'finished') {
            // Get all players with bets
            const { data: players } = await supabase
              .from('lucky9_players')
              .select('*')
              .eq('game_id', gameId)
              .eq('is_active', true)
              .eq('is_banker', false);

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

            // Mark game as finished
            await supabase
              .from('lucky9_games')
              .update({ status: 'finished' })
              .eq('id', gameId);
          }
        }

        // Delete the banker
        await supabase
          .from('lucky9_players')
          .delete()
          .eq('id', playerId);

        return new Response(JSON.stringify({ success: true, bankerLeft: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'player_leave': {
        // When a player leaves mid-game, banker wins their bet
        const { gameId } = body;
        console.log('Player leaving game:', gameId);

        // Get the player
        const { data: player } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (player && gameId && player.current_bet > 0) {
          // Get the game
          const { data: game } = await supabase
            .from('lucky9_games')
            .select('*')
            .eq('id', gameId)
            .single();

          if (game && game.status !== 'finished' && game.banker_id) {
            // Get the banker
            const { data: banker } = await supabase
              .from('lucky9_players')
              .select('*')
              .eq('id', game.banker_id)
              .single();

            if (banker) {
              // Banker wins the player's bet
              await supabase
                .from('lucky9_players')
                .update({ 
                  stack: banker.stack + player.current_bet
                })
                .eq('id', banker.id);
            }
          }

          // Check if this was the current player's turn - advance to next
          if (game?.current_player_position === player.position && game?.status === 'player_turns') {
            // Get remaining players
            const { data: remainingPlayers } = await supabase
              .from('lucky9_players')
              .select('*')
              .eq('game_id', gameId)
              .eq('is_active', true)
              .eq('is_banker', false)
              .neq('id', playerId)
              .order('position');

            const nextPlayer = remainingPlayers?.find(p => p.position > player.position && !p.has_acted);
            
            if (nextPlayer) {
              await supabase
                .from('lucky9_games')
                .update({ current_player_position: nextPlayer.position })
                .eq('id', gameId);
            } else {
              // No more players, move to banker turn
              await supabase
                .from('lucky9_games')
                .update({ status: 'banker_turn', current_player_position: null })
                .eq('id', gameId);
            }
          }
        }

        // Delete the player
        await supabase
          .from('lucky9_players')
          .delete()
          .eq('id', playerId);

        return new Response(JSON.stringify({ success: true }), {
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
