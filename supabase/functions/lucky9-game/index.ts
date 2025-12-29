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

    const { action, tableId, playerId, betAmount } = await req.json();
    console.log('Lucky9 action:', action, 'tableId:', tableId, 'playerId:', playerId);

    switch (action) {
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

      case 'start_round': {
        // Get all active players with bets
        const { data: players } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('table_id', tableId)
          .eq('is_active', true)
          .gt('current_bet', 0)
          .order('position');

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

        // Deal dealer cards (2 cards, one hidden)
        const dealerCards = [deck[deckIndex++]];
        const dealerHiddenCard = deck[deckIndex++];

        // Create game
        const { data: game, error: gameError } = await supabase
          .from('lucky9_games')
          .insert({
            table_id: tableId,
            status: 'player_turns',
            dealer_cards: dealerCards,
            dealer_hidden_card: dealerHiddenCard,
            current_player_position: players[0].position
          })
          .select()
          .single();

        if (gameError) {
          console.error('Game creation error:', gameError);
          return new Response(JSON.stringify({ error: gameError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update players with game_id
        await supabase
          .from('lucky9_players')
          .update({ game_id: game.id })
          .eq('table_id', tableId)
          .eq('is_active', true);

        // Store remaining deck in game (we'll need it for draws)
        const remainingDeck = deck.slice(deckIndex);

        return new Response(JSON.stringify({ 
          success: true, 
          gameId: game.id,
          remainingDeck 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'player_action': {
        const { playerAction, gameId, remainingDeck } = await req.json();

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

        if (player.cards.length >= 3) {
          return new Response(JSON.stringify({ error: 'Maximum 3 cards reached' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let updatedCards = [...player.cards];
        let updatedDeck = [...remainingDeck];

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

        // Check if all players have acted
        const { data: allPlayers } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .order('position');

        const allActed = allPlayers?.every(p => p.has_acted || p.id === playerId);
        
        // Find next player who hasn't acted
        const currentPos = player.position;
        const nextPlayer = allPlayers?.find(p => p.position > currentPos && !p.has_acted && p.id !== playerId);

        if (allActed || !nextPlayer) {
          // Move to dealer turn
          await supabase
            .from('lucky9_games')
            .update({ 
              status: 'dealer_turn',
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

      case 'dealer_play': {
        const { gameId, remainingDeck } = await req.json();

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

        // Reveal hidden card
        let dealerCards = [...game.dealer_cards, game.dealer_hidden_card];
        let dealerValue = calculateLucky9Value(dealerCards);
        let updatedDeck = [...remainingDeck];

        // Dealer draws if value is 5 or less
        if (dealerValue <= 5 && dealerCards.length < 3) {
          const newCard = updatedDeck.shift();
          if (newCard) {
            dealerCards.push(newCard);
            dealerValue = calculateLucky9Value(dealerCards);
          }
        }

        const dealerIsNatural = game.dealer_cards.length === 1 && 
          isNatural9([game.dealer_cards[0], game.dealer_hidden_card]);

        // Update game with final dealer cards
        await supabase
          .from('lucky9_games')
          .update({ 
            dealer_cards: dealerCards,
            dealer_hidden_card: null,
            status: 'showdown'
          })
          .eq('id', gameId);

        // Calculate results for each player
        const { data: players } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true);

        for (const player of players || []) {
          const playerValue = calculateLucky9Value(player.cards);
          let result: string;
          let winnings = 0;

          if (player.is_natural && !dealerIsNatural) {
            // Player natural 9 wins 2:1
            result = 'natural_win';
            winnings = player.current_bet * 3; // Original bet + 2x payout
          } else if (dealerIsNatural && !player.is_natural) {
            // Dealer natural 9 wins
            result = 'lose';
            winnings = 0;
          } else if (playerValue > dealerValue) {
            result = 'win';
            winnings = player.current_bet * 2; // Original bet + 1x payout
          } else if (playerValue < dealerValue) {
            result = 'lose';
            winnings = 0;
          } else {
            result = 'push';
            winnings = player.current_bet; // Return bet
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

        // Update game status to finished
        await supabase
          .from('lucky9_games')
          .update({ status: 'finished' })
          .eq('id', gameId);

        return new Response(JSON.stringify({ 
          success: true, 
          dealerCards,
          dealerValue,
          dealerIsNatural
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
