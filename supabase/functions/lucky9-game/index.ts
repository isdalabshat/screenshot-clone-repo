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

        // Check if there's an active game (prevent joining during betting/playing)
        const { data: activeGame } = await supabase
          .from('lucky9_games')
          .select('status')
          .eq('table_id', tableId)
          .in('status', ['betting', 'accepting_bets', 'dealing', 'player_turns', 'banker_turn', 'calculating', 'revealing', 'showdown'])
          .maybeSingle();

        if (activeGame && role !== 'banker') {
          return new Response(JSON.stringify({ 
            error: 'Cannot join during an active round. Please wait for the round to finish.',
            waitForRound: true
          }), {
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
        // Get game - allow starting from 'betting' status (banker can deal anytime)
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

        // Only allow starting from betting phase
        if (game.status !== 'betting') {
          return new Response(JSON.stringify({ error: 'Game is not in betting phase' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get table to check call time settings
        const { data: tableData } = await supabase
          .from('lucky9_tables')
          .select('call_time_minutes, call_time_started_at, call_time_banker_id')
          .eq('id', game.table_id)
          .single();

        // First, return chips to players with pending bets (not accepted)
        const { data: pendingBetPlayers } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false)
          .is('bet_accepted', null)
          .gt('current_bet', 0);

        // Return pending bets to players
        for (const player of pendingBetPlayers || []) {
          console.log('Returning pending bet to player:', player.username, 'amount:', player.current_bet);
          await supabase
            .from('lucky9_players')
            .update({ 
              stack: player.stack + player.current_bet,
              current_bet: 0,
              bet_accepted: false
            })
            .eq('id', player.id);
        }

        // Also return chips to rejected players
        const { data: rejectedPlayers } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false)
          .eq('bet_accepted', false)
          .gt('current_bet', 0);

        for (const player of rejectedPlayers || []) {
          console.log('Returning rejected bet to player:', player.username, 'amount:', player.current_bet);
          await supabase
            .from('lucky9_players')
            .update({ 
              stack: player.stack + player.current_bet,
              current_bet: 0
            })
            .eq('id', player.id);
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

        // Activate Call Time if configured and not already active
        // Call time activates when banker starts the first round
        if (tableData?.call_time_minutes && !tableData.call_time_started_at) {
          console.log('Activating Call Time:', tableData.call_time_minutes, 'minutes for banker:', banker.user_id);
          await supabase
            .from('lucky9_tables')
            .update({
              call_time_started_at: new Date().toISOString(),
              call_time_banker_id: banker.user_id
            })
            .eq('id', game.table_id);
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

        // NEW NATURAL 9 LOGIC:
        // - If banker has natural 9: ALL games end immediately (banker beats non-naturals, draws with naturals)
        // - If only players have natural 9 (banker doesn't): 
        //   - Natural 9 players WIN immediately and their winnings are secured
        //   - Non-natural players continue the game normally
        
        if (bankerNatural) {
          // Banker has natural 9 - END THE GAME IMMEDIATELY for everyone
          console.log('Banker has Natural 9! Game ends immediately.');
          
          await supabase
            .from('lucky9_games')
            .update({
              status: 'calculating',
              dealer_cards: bankerCards,
              dealer_hidden_card: null,
              current_player_position: null,
              betting_ends_at: null
            })
            .eq('id', gameId);

          const bankerValue = calculateLucky9Value(bankerCards);
          let bankerTotalWin = 0;
          let bankerTotalLoss = 0;
          let totalFeesCollected = 0;
          let totalWinningsForFee = 0;

          for (const player of players) {
            const playerCards = [deck[(players.indexOf(player)) * 2], deck[(players.indexOf(player)) * 2 + 1]];
            const playerValue = calculateLucky9Value(playerCards);
            const playerIsNatural = isNatural9(playerCards);
            
            const { data: currentPlayer } = await supabase
              .from('lucky9_players')
              .select('current_bet, stack')
              .eq('id', player.id)
              .single();
            
            const currentBet = currentPlayer?.current_bet || 0;
            const currentStack = currentPlayer?.stack || 0;
            
            let result: string;
            let netWinnings = 0;

            if (playerIsNatural) {
              // Both have natural 9 - DRAW
              result = 'push';
              netWinnings = currentBet; // Return bet, no fee on push
              console.log(`Player ${player.username} has natural 9 vs banker natural 9 - DRAW`);
            } else {
              // Banker natural 9 beats non-natural player
              result = 'lose';
              netWinnings = 0;
              bankerTotalWin += currentBet;
              console.log(`Player ${player.username} loses to banker natural 9`);
            }

            await supabase
              .from('lucky9_players')
              .update({ 
                result,
                winnings: netWinnings,
                stack: currentStack + netWinnings,
                has_acted: true,
                has_stood: true
              })
              .eq('id', player.id);
          }

          // Calculate banker's net winnings with 10% fee
          let bankerNetWin = bankerTotalWin - bankerTotalLoss;
          let bankerFee = 0;
          if (bankerNetWin > 0) {
            bankerFee = Math.floor(bankerNetWin * 0.10);
            bankerNetWin = bankerNetWin - bankerFee;
            totalFeesCollected += bankerFee;
            totalWinningsForFee += bankerTotalWin;
          }

          const newBankerStack = banker.stack + bankerNetWin;
          await supabase
            .from('lucky9_players')
            .update({ 
              stack: newBankerStack,
              result: bankerNetWin > 0 ? 'win' : bankerNetWin < 0 ? 'lose' : 'push',
              winnings: bankerNetWin,
              has_acted: true,
              has_stood: true
            })
            .eq('id', banker.id);

          if (totalFeesCollected > 0) {
            await supabase
              .from('lucky9_fees')
              .insert({
                game_id: gameId,
                table_id: tableId,
                fee_amount: totalFeesCollected,
                total_winnings: totalWinningsForFee
              });
            console.log('Lucky 9 banker natural win fee recorded:', totalFeesCollected);
          }

          return new Response(JSON.stringify({ 
            success: true, 
            gameId,
            remainingDeck,
            naturalWin: true,
            bankerNatural: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Banker does NOT have natural 9
        // Check if any players have natural 9 - they WIN immediately
        // Non-natural players continue the game
        
        let bankerTotalLossFromNaturals = 0;
        let totalFeesFromNaturals = 0;
        let totalWinningsFromNaturals = 0;
        
        for (const player of players) {
          const playerCards = [deck[(players.indexOf(player)) * 2], deck[(players.indexOf(player)) * 2 + 1]];
          const playerIsNatural = isNatural9(playerCards);
          
          if (playerIsNatural) {
            // Player has natural 9 and banker doesn't - IMMEDIATE WIN
            const { data: currentPlayer } = await supabase
              .from('lucky9_players')
              .select('current_bet, stack')
              .eq('id', player.id)
              .single();
            
            const currentBet = currentPlayer?.current_bet || 0;
            const currentStack = currentPlayer?.stack || 0;
            
            // Natural 9 pays 1:1 (same as regular win) - fee only on profit
            const profit = currentBet; // Natural pays 1x profit (same as regular)
            const grossWinnings = currentBet + profit;
            const feeDeducted = Math.floor(profit * 0.10); // 10% fee on profit only
            const netWinnings = grossWinnings - feeDeducted;
            
            bankerTotalLossFromNaturals += profit; // Banker loses the profit amount
            totalFeesFromNaturals += feeDeducted;
            totalWinningsFromNaturals += profit;
            
            console.log(`Player ${player.username} has NATURAL 9! Wins immediately: ₱${netWinnings}`);
            
            await supabase
              .from('lucky9_players')
              .update({ 
                result: 'natural_win',
                winnings: netWinnings,
                stack: currentStack + netWinnings,
                has_acted: true,
                has_stood: true
              })
              .eq('id', player.id);
          }
        }
        
        // Deduct natural 9 losses from banker immediately
        if (bankerTotalLossFromNaturals > 0) {
          const newBankerStack = banker.stack - bankerTotalLossFromNaturals;
          await supabase
            .from('lucky9_players')
            .update({ 
              stack: newBankerStack
            })
            .eq('id', banker.id);
          
          console.log(`Banker pays ₱${bankerTotalLossFromNaturals} to natural 9 winners`);
        }
        
        // Record fees from natural 9 wins
        if (totalFeesFromNaturals > 0) {
          await supabase
            .from('lucky9_fees')
            .insert({
              game_id: gameId,
              table_id: tableId,
              fee_amount: totalFeesFromNaturals,
              total_winnings: totalWinningsFromNaturals
            });
          console.log('Lucky 9 natural win fees recorded:', totalFeesFromNaturals);
        }
        
        // Check if ALL players have natural 9 - if so, game is over
        const allPlayersNatural = players.every((p, idx) => {
          const playerCards = [deck[idx * 2], deck[idx * 2 + 1]];
          return isNatural9(playerCards);
        });
        
        if (allPlayersNatural) {
          // All players had natural 9, game ends
          console.log('All players have natural 9! Game ends.');
          
          await supabase
            .from('lucky9_games')
            .update({
              status: 'calculating',
              dealer_cards: bankerCards,
              dealer_hidden_card: null,
              current_player_position: null,
              betting_ends_at: null
            })
            .eq('id', gameId);
          
          // Update banker result
          const { data: updatedBanker } = await supabase
            .from('lucky9_players')
            .select('stack')
            .eq('id', banker.id)
            .single();
          
          await supabase
            .from('lucky9_players')
            .update({ 
              result: 'lose',
              winnings: -bankerTotalLossFromNaturals,
              has_acted: true,
              has_stood: true
            })
            .eq('id', banker.id);

          return new Response(JSON.stringify({ 
            success: true, 
            gameId,
            remainingDeck,
            naturalWin: true,
            allPlayersNatural: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Find first NON-NATURAL player to act
        const firstPlayer = players.find((p, idx) => {
          const playerCards = [deck[idx * 2], deck[idx * 2 + 1]];
          return !isNatural9(playerCards);
        });

        // Update game - normal flow for non-natural players
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
          remainingDeck,
          anyPlayerNatural,
          naturalPlayersSettled: anyPlayerNatural
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

        // Get all players with accepted bets that HAVEN'T been settled yet (natural 9 players already settled)
        const { data: players } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true)
          .eq('is_banker', false)
          .eq('bet_accepted', true);

        let bankerTotalWin = 0;
        let bankerTotalLoss = 0;
        let totalFeesCollected = 0;
        let totalWinningsForFee = 0;

        for (const player of players || []) {
          // SKIP players who already have a result (natural 9 winners were already settled during dealing)
          if (player.result === 'natural_win') {
            console.log('Skipping already settled natural_win player:', player.username);
            continue;
          }

          const playerValue = calculateLucky9Value(player.cards || []);
          const playerIsNatural = player.is_natural; // Had 9 with initial 2 cards
          let result: string;
          let grossWinnings = 0;
          let netWinnings = 0;
          let feeDeducted = 0;

          // Fee is only on PROFIT (winnings minus original bet), not on gross winnings
          // Case 1: Player has natural 9, banker doesn't - player wins (1:1 same as regular)
          // NOTE: This case should rarely hit now since naturals are settled at deal time
          if (playerIsNatural && !bankerIsNatural) {
            result = 'natural_win';
            const profit = player.current_bet; // Natural pays 1x profit (same as regular)
            grossWinnings = player.current_bet + profit; // Total payout = bet + profit
            feeDeducted = Math.floor(profit * 0.10); // 10% fee on profit only
            netWinnings = grossWinnings - feeDeducted;
            bankerTotalLoss += profit;
          }
          // Case 2: Banker has natural 9, player doesn't - banker wins
          else if (bankerIsNatural && !playerIsNatural) {
            result = 'lose';
            netWinnings = 0;
            bankerTotalWin += player.current_bet;
          }
          // Case 3: Both have same value (tie scenarios)
          else if (playerValue === bankerValue) {
            // Tiebreaker: Natural 9 beats non-natural 9
            if (playerIsNatural && !bankerIsNatural) {
              result = 'natural_win';
              const profit = player.current_bet; // Natural pays 1x profit (same as regular)
              grossWinnings = player.current_bet + profit;
              feeDeducted = Math.floor(profit * 0.10);
              netWinnings = grossWinnings - feeDeducted;
              bankerTotalLoss += profit;
            } else if (bankerIsNatural && !playerIsNatural) {
              result = 'lose';
              netWinnings = 0;
              bankerTotalWin += player.current_bet;
            } else {
              // Both natural or both non-natural with same value - push (no fee on push)
              result = 'push';
              netWinnings = player.current_bet;
            }
          }
          // Case 4: Player has higher value - normal win (2x = bet + 1x profit)
          else if (playerValue > bankerValue) {
            result = 'win';
            const profit = player.current_bet; // Normal pays 1x profit
            grossWinnings = player.current_bet + profit;
            feeDeducted = Math.floor(profit * 0.10); // 10% fee on profit only
            netWinnings = grossWinnings - feeDeducted;
            bankerTotalLoss += profit;
          } 
          // Case 5: Banker has higher value
          else {
            result = 'lose';
            netWinnings = 0;
            bankerTotalWin += player.current_bet;
          }

          totalFeesCollected += feeDeducted;
          if (grossWinnings > 0) totalWinningsForFee += grossWinnings;

          console.log('Settling player:', player.username, 'result:', result, 'netWinnings:', netWinnings);
          
          await supabase
            .from('lucky9_players')
            .update({ 
              result,
              winnings: netWinnings,
              stack: player.stack + netWinnings
            })
            .eq('id', player.id);
        }

        // Calculate banker's net winnings with 10% fee if banker won
        let bankerNetWin = bankerTotalWin - bankerTotalLoss;
        let bankerFee = 0;
        if (bankerNetWin > 0) {
          bankerFee = Math.floor(bankerNetWin * 0.10);
          bankerNetWin = bankerNetWin - bankerFee;
          totalFeesCollected += bankerFee;
          totalWinningsForFee += bankerTotalWin;
        }

        // Update banker stack with fee deducted from winnings
        const newBankerStack = banker.stack + bankerNetWin;
        await supabase
          .from('lucky9_players')
          .update({ 
            stack: newBankerStack,
            result: bankerTotalWin > bankerTotalLoss ? 'win' : bankerTotalWin < bankerTotalLoss ? 'lose' : 'push',
            winnings: bankerNetWin
          })
          .eq('id', banker.id);

        // Record collected fees
        if (totalFeesCollected > 0) {
          await supabase
            .from('lucky9_fees')
            .insert({
              game_id: gameId,
              table_id: tableId,
              fee_amount: totalFeesCollected,
              total_winnings: totalWinningsForFee
            });
          console.log('Lucky 9 fee recorded:', totalFeesCollected, 'from total winnings:', totalWinningsForFee);
        }

        // Game status is already 'calculating' - client will transition to 'revealing' after 1 sec
        // The calculation has been done, but we let client handle the timed transitions

        // Check for zero balance and auto-kick players/banker
        const kickedPlayers: string[] = [];

        // Check banker balance
        if (newBankerStack <= 0) {
          console.log('Banker has zero balance, auto-kicking');
          kickedPlayers.push(banker.user_id);
          
          // Banker leaving ends Call Time immediately
          await supabase
            .from('lucky9_tables')
            .update({
              call_time_started_at: null,
              call_time_banker_id: null
            })
            .eq('id', tableId);
          console.log('Call Time ended - banker auto-kicked due to zero balance');
          
          // Banker has no chips to return (zero balance), just delete - DO NOT return any money
          await supabase
            .from('lucky9_players')
            .delete()
            .eq('id', banker.id);
        }

        // Check all players - only auto-kick those with zero or negative balance
        for (const player of players || []) {
          // Skip players that were already settled (natural_win players were processed during dealing)
          if (player.result === 'natural_win') {
            console.log('Skipping natural_win player for zero balance check:', player.username);
            continue;
          }
          
          const { data: updatedPlayer } = await supabase
            .from('lucky9_players')
            .select('stack, user_id, id')
            .eq('id', player.id)
            .single();

          if (updatedPlayer && updatedPlayer.stack <= 0) {
            console.log('Player has zero balance, auto-kicking:', updatedPlayer.user_id);
            kickedPlayers.push(updatedPlayer.user_id);
            
            // Player has no chips to return (zero balance), just delete - DO NOT return any money
            await supabase
              .from('lucky9_players')
              .delete()
              .eq('id', updatedPlayer.id);
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
        console.log('Resetting round for table:', tableId);
        
        // First, delete any finished games for this table
        await supabase
          .from('lucky9_games')
          .delete()
          .eq('table_id', tableId)
          .eq('status', 'finished');
        
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

        console.log('Round reset complete');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      case 'advance_game_phase': {
        // Server-side phase advancement to avoid race conditions
        console.log('Advancing game phase:', gameId, 'from:', body.fromPhase, 'to:', body.toPhase);
        
        if (!gameId) {
          return new Response(JSON.stringify({ error: 'gameId required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const { fromPhase, toPhase } = body;
        
        // Get current game state
        const { data: currentGame } = await supabase
          .from('lucky9_games')
          .select('status')
          .eq('id', gameId)
          .single();
        
        if (!currentGame) {
          console.log('Game not found for phase advance:', gameId);
          return new Response(JSON.stringify({ success: false, reason: 'game_not_found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Only advance if still in the expected phase
        if (currentGame.status !== fromPhase) {
          console.log('Game already advanced from', fromPhase, 'to', currentGame.status);
          return new Response(JSON.stringify({ success: true, alreadyAdvanced: true, currentStatus: currentGame.status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Perform the transition
        const { error } = await supabase
          .from('lucky9_games')
          .update({ status: toPhase, updated_at: new Date().toISOString() })
          .eq('id', gameId)
          .eq('status', fromPhase);
        
        if (error) {
          console.error('Error advancing phase:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('Phase advanced successfully to:', toPhase);
        return new Response(JSON.stringify({ success: true, newPhase: toPhase }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'banker_leave': {
        // When banker leaves mid-game, banker is marked as loss and all players win their bets
        // ALSO: Banker leaving ends Call Time immediately
        console.log('Banker leaving table:', tableId);

        // Clear Call Time when banker leaves
        await supabase
          .from('lucky9_tables')
          .update({
            call_time_started_at: null,
            call_time_banker_id: null
          })
          .eq('id', tableId);
        console.log('Call Time ended - banker left');

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

        // Check if game is in a phase where bets are already locked in (dealing onwards)
        const gameInProgress = currentGame && ['dealing', 'player_turns', 'banker_turn', 'calculating', 'revealing', 'showdown'].includes(currentGame.status);
        
        if (currentGame && bankerPlayer && gameInProgress) {
          // Game in progress - banker forfeits, players win their bets
          console.log('Banker leaving mid-game - players win their accepted bets');
          
          // Mark banker as LOSS with 0 winnings
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

          // All players win - return their bet + winnings (2x bet) from banker's stack
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
        } else if (currentGame && bankerPlayer && currentGame.status === 'betting') {
          // Betting phase - just return all bets, no one wins or loses
          console.log('Banker leaving during betting - returning all bets');
          
          // Return ALL bets to players (pending and accepted)
          const { data: allBettingPlayers } = await supabase
            .from('lucky9_players')
            .select('*')
            .eq('game_id', currentGame.id)
            .eq('is_active', true)
            .eq('is_banker', false)
            .gt('current_bet', 0);

          for (const player of allBettingPlayers || []) {
            await supabase
              .from('lucky9_players')
              .update({ 
                stack: player.stack + player.current_bet,
                current_bet: 0,
                bet_accepted: null,
                result: null
              })
              .eq('id', player.id);
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

        return new Response(JSON.stringify({ success: true, bankerLeft: true, callTimeEnded: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'player_leave': {
        // When a player leaves mid-game, they are marked as loss and banker wins their bet
        // BUT: Players CANNOT leave during Call Time (only banker can)
        console.log('Player leaving table:', tableId, 'userId:', userId);

        // Check Call Time - players cannot leave during active call time
        const { data: tableCallTime } = await supabase
          .from('lucky9_tables')
          .select('call_time_minutes, call_time_started_at, call_time_banker_id')
          .eq('id', tableId)
          .single();

        if (tableCallTime?.call_time_started_at && tableCallTime.call_time_minutes) {
          const callTimeStart = new Date(tableCallTime.call_time_started_at);
          const callTimeEnd = new Date(callTimeStart.getTime() + tableCallTime.call_time_minutes * 60 * 1000);
          const now = new Date();
          
          if (now < callTimeEnd) {
            const remainingMinutes = Math.ceil((callTimeEnd.getTime() - now.getTime()) / 60000);
            console.log('Player blocked from leaving - Call Time active, remaining:', remainingMinutes, 'minutes');
            return new Response(JSON.stringify({ 
              error: `Call Time is active. You cannot leave for ${remainingMinutes} more minute(s). Only the banker can leave during Call Time.`,
              callTimeActive: true,
              remainingMinutes
            }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

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

        // Check if game is in progress (dealing onwards) where bet is locked in
        const gameInProgress = currentGame && ['dealing', 'player_turns', 'banker_turn', 'calculating', 'revealing', 'showdown'].includes(currentGame.status);
        
        if (currentGame && player.current_bet > 0 && player.bet_accepted === true && gameInProgress) {
          // Game in progress - player forfeits their bet to banker
          console.log('Player leaving mid-game - forfeiting bet:', player.current_bet);
          
          // Mark player as LOSS
          await supabase
            .from('lucky9_players')
            .update({ 
              result: 'lose',
              winnings: 0
            })
            .eq('id', player.id);

          // Get the banker and give them the forfeited bet
          const { data: banker } = await supabase
            .from('lucky9_players')
            .select('*')
            .eq('id', currentGame.banker_id)
            .single();

          if (banker) {
            await supabase
              .from('lucky9_players')
              .update({ 
                stack: banker.stack + player.current_bet
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
          
          // Player loses bet, only return their remaining stack (not the bet)
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
        } else if (currentGame && currentGame.status === 'betting' && player.current_bet > 0) {
          // During betting phase - return bet to player
          console.log('Player leaving during betting - returning bet:', player.current_bet);
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('chips')
            .eq('user_id', userId)
            .single();

          if (profile) {
            // Return both stack and current bet during betting phase
            await supabase
              .from('profiles')
              .update({ chips: profile.chips + player.stack + player.current_bet })
              .eq('user_id', userId);
          }
        } else {
          // No active game or no bet - just return stack
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
        }

        // Delete the player
        await supabase
          .from('lucky9_players')
          .delete()
          .eq('id', player.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'force_finish': {
        // Force finish a stuck game - returns all pending bets
        console.log('Force finishing stuck game:', gameId);

        if (!gameId) {
          return new Response(JSON.stringify({ error: 'Missing gameId' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get the game
        const { data: stuckGame } = await supabase
          .from('lucky9_games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (!stuckGame) {
          return new Response(JSON.stringify({ error: 'Game not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Return pending bets to all players
        const { data: allPlayers } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('is_active', true);

        for (const player of allPlayers || []) {
          if (player.current_bet > 0 && !player.result) {
            // Return bet to player's stack
            await supabase
              .from('lucky9_players')
              .update({ 
                stack: player.stack + player.current_bet,
                current_bet: 0,
                result: 'push',
                winnings: player.current_bet
              })
              .eq('id', player.id);
          }
        }

        // Mark game as finished
        await supabase
          .from('lucky9_games')
          .update({ status: 'finished' })
          .eq('id', gameId);

        console.log('Stuck game force finished and bets returned');

        return new Response(JSON.stringify({ success: true, forceFinished: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'check_stuck_game': {
        // Check if a game is stuck and needs force finishing
        console.log('Checking for stuck game at table:', tableId);

        const { data: activeGame } = await supabase
          .from('lucky9_games')
          .select('*')
          .eq('table_id', tableId)
          .neq('status', 'finished')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!activeGame) {
          return new Response(JSON.stringify({ success: true, noActiveGame: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if game is older than 2 minutes
        const gameAge = Date.now() - new Date(activeGame.updated_at).getTime();
        const isStuck = gameAge > 2 * 60 * 1000; // 2 minutes

        if (isStuck) {
          console.log('Game is stuck - age:', Math.floor(gameAge / 1000), 'seconds');
          return new Response(JSON.stringify({ 
            success: true, 
            isStuck: true, 
            gameId: activeGame.id,
            status: activeGame.status,
            ageSeconds: Math.floor(gameAge / 1000)
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, isStuck: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'kick_player': {
        // Admin only - kick a player from the table
        // First verify the user is an admin
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        if (!adminCheck) {
          return new Response(JSON.stringify({ error: 'Unauthorized: Admin only' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get the player to kick
        const { data: playerToKick } = await supabase
          .from('lucky9_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (!playerToKick) {
          return new Response(JSON.stringify({ error: 'Player not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Return their stack to their profile
        if (playerToKick.stack > 0) {
          const { data: kickedProfile } = await supabase
            .from('profiles')
            .select('chips')
            .eq('user_id', playerToKick.user_id)
            .single();

          if (kickedProfile) {
            await supabase
              .from('profiles')
              .update({ chips: kickedProfile.chips + playerToKick.stack })
              .eq('user_id', playerToKick.user_id);
          }
        }

        // If player had a bet, return it too
        if (playerToKick.current_bet > 0) {
          const { data: kickedProfile } = await supabase
            .from('profiles')
            .select('chips')
            .eq('user_id', playerToKick.user_id)
            .single();

          if (kickedProfile) {
            await supabase
              .from('profiles')
              .update({ chips: kickedProfile.chips + playerToKick.current_bet })
              .eq('user_id', playerToKick.user_id);
          }
        }

        // Delete the player
        await supabase
          .from('lucky9_players')
          .delete()
          .eq('id', playerId);

        console.log('Player kicked by admin:', playerId);

        return new Response(JSON.stringify({ success: true, kicked: true }), {
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
