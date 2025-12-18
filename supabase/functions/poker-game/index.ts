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

interface SidePot {
  amount: number;
  eligiblePlayers: string[]; // user_ids
  allInAmount: number;
}

const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Card['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANKS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

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

function stringToCard(str: string): Card {
  const suitChar = str[str.length - 1];
  const rank = str.slice(0, -1) as Card['rank'];
  const suitMap: Record<string, Card['suit']> = { 'H': 'hearts', 'D': 'diamonds', 'C': 'clubs', 'S': 'spades' };
  return { rank, suit: suitMap[suitChar] };
}

function evaluateHand(holeCards: string[], communityCards: string[]): { rank: number; name: string; kickers: number[] } {
  const allCards = [...holeCards, ...communityCards].map(stringToCard);
  const combinations = getCombinations(allCards, 5);
  let bestHand = { rank: 0, name: 'High Card', kickers: [0] };
  
  for (const combo of combinations) {
    const hand = evaluateFiveCards(combo);
    if (hand.rank > bestHand.rank || 
        (hand.rank === bestHand.rank && compareKickers(hand.kickers, bestHand.kickers) > 0)) {
      bestHand = hand;
    }
  }
  
  return bestHand;
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - size; i++) {
    const rest = getCombinations(arr.slice(i + 1), size - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

function evaluateFiveCards(cards: Card[]): { rank: number; name: string; kickers: number[] } {
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);
  const isLowStraight = values.includes(14) && values.includes(5) && values.includes(4) && values.includes(3) && values.includes(2);
  
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const countValues = Object.entries(counts).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
  
  if (isFlush && isStraight && values[0] === 14) {
    return { rank: HAND_RANKS.ROYAL_FLUSH, name: 'Royal Flush', kickers: values };
  }
  
  if (isFlush && (isStraight || isLowStraight)) {
    return { rank: HAND_RANKS.STRAIGHT_FLUSH, name: 'Straight Flush', kickers: isLowStraight ? [5, 4, 3, 2, 1] : values };
  }
  
  if (countValues[0][1] === 4) {
    const quad = Number(countValues[0][0]);
    const kicker = Number(countValues[1][0]);
    return { rank: HAND_RANKS.FOUR_OF_A_KIND, name: 'Four of a Kind', kickers: [quad, kicker] };
  }
  
  if (countValues[0][1] === 3 && countValues[1][1] === 2) {
    return { rank: HAND_RANKS.FULL_HOUSE, name: 'Full House', kickers: [Number(countValues[0][0]), Number(countValues[1][0])] };
  }
  
  if (isFlush) {
    return { rank: HAND_RANKS.FLUSH, name: 'Flush', kickers: values };
  }
  
  if (isStraight || isLowStraight) {
    return { rank: HAND_RANKS.STRAIGHT, name: 'Straight', kickers: isLowStraight ? [5, 4, 3, 2, 1] : values };
  }
  
  if (countValues[0][1] === 3) {
    const trip = Number(countValues[0][0]);
    const kickers = values.filter(v => v !== trip).slice(0, 2);
    return { rank: HAND_RANKS.THREE_OF_A_KIND, name: 'Three of a Kind', kickers: [trip, ...kickers] };
  }
  
  if (countValues[0][1] === 2 && countValues[1][1] === 2) {
    const high = Math.max(Number(countValues[0][0]), Number(countValues[1][0]));
    const low = Math.min(Number(countValues[0][0]), Number(countValues[1][0]));
    const kicker = Number(countValues[2][0]);
    return { rank: HAND_RANKS.TWO_PAIR, name: 'Two Pair', kickers: [high, low, kicker] };
  }
  
  if (countValues[0][1] === 2) {
    const pair = Number(countValues[0][0]);
    const kickers = values.filter(v => v !== pair).slice(0, 3);
    return { rank: HAND_RANKS.PAIR, name: 'Pair', kickers: [pair, ...kickers] };
  }
  
  return { rank: HAND_RANKS.HIGH_CARD, name: 'High Card', kickers: values };
}

function checkStraight(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => b - a);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] - sorted[i + 1] !== 1) return false;
  }
  return true;
}

function compareKickers(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function calculateFee(pot: number, bigBlind: number, gameStatus: string): number {
  if (gameStatus === 'preflop') return 0;
  if (pot < bigBlind * 5) return 0;
  return Math.floor(pot * 0.10);
}

// Calculate side pots when players are all-in with different amounts
function calculateSidePots(players: any[]): SidePot[] {
  const activePlayers = players.filter(p => !p.is_folded);
  if (activePlayers.length === 0) return [];
  
  // Get all unique contribution levels (total bet amounts)
  const contributions = activePlayers.map(p => ({
    userId: p.user_id,
    totalContribution: p.current_bet,
    isAllIn: p.is_all_in
  })).sort((a, b) => a.totalContribution - b.totalContribution);
  
  // Get unique all-in amounts
  const allInAmounts = [...new Set(
    contributions
      .filter(c => c.isAllIn)
      .map(c => c.totalContribution)
  )].sort((a, b) => a - b);
  
  if (allInAmounts.length === 0) {
    // No all-ins, single main pot
    const totalPot = contributions.reduce((sum, c) => sum + c.totalContribution, 0);
    return [{
      amount: totalPot,
      eligiblePlayers: activePlayers.map(p => p.user_id),
      allInAmount: 0
    }];
  }
  
  const sidePots: SidePot[] = [];
  let previousLevel = 0;
  
  for (const allInAmount of allInAmounts) {
    const contributionForThisPot = allInAmount - previousLevel;
    const eligiblePlayers = activePlayers
      .filter(p => p.current_bet >= allInAmount)
      .map(p => p.user_id);
    
    // Each eligible player contributes (allInAmount - previousLevel) to this pot
    const potAmount = contributionForThisPot * activePlayers.filter(p => p.current_bet >= allInAmount || p.current_bet > previousLevel).length;
    
    if (potAmount > 0 && eligiblePlayers.length > 0) {
      sidePots.push({
        amount: potAmount,
        eligiblePlayers,
        allInAmount
      });
    }
    
    previousLevel = allInAmount;
  }
  
  // Main pot for remaining amounts above highest all-in
  const maxAllIn = Math.max(...allInAmounts);
  const remainingPlayers = activePlayers.filter(p => p.current_bet > maxAllIn && !p.is_all_in);
  if (remainingPlayers.length > 0) {
    const remainingContributions = activePlayers
      .filter(p => p.current_bet > maxAllIn)
      .reduce((sum, p) => sum + (p.current_bet - maxAllIn), 0);
    
    if (remainingContributions > 0) {
      sidePots.push({
        amount: remainingContributions,
        eligiblePlayers: remainingPlayers.map(p => p.user_id),
        allInAmount: 0
      });
    }
  }
  
  return sidePots;
}

// Distribute pot with side pots consideration
function distributePotWithSidePots(
  players: any[],
  communityCards: string[],
  totalPot: number,
  bigBlind: number,
  gameStatus: string
): { distributions: { playerId: string; amount: number }[]; fee: number } {
  const activePlayers = players.filter(p => !p.is_folded);
  
  if (activePlayers.length === 1) {
    const fee = calculateFee(totalPot, bigBlind, gameStatus);
    return {
      distributions: [{ playerId: activePlayers[0].id, amount: totalPot - fee }],
      fee
    };
  }
  
  // Evaluate all hands
  const playerHands = activePlayers.map(p => ({
    player: p,
    hand: evaluateHand(p.hole_cards || [], communityCards)
  }));
  
  // Calculate side pots
  const sidePots = calculateSidePots(activePlayers);
  
  // Calculate total fee on the total pot
  const fee = calculateFee(totalPot, bigBlind, gameStatus);
  const feePerPot = sidePots.length > 0 ? fee / sidePots.length : 0;
  
  const distributions: Map<string, number> = new Map();
  
  for (const sidePot of sidePots) {
    // Find winners for this pot (only eligible players)
    const eligibleHands = playerHands.filter(ph => 
      sidePot.eligiblePlayers.includes(ph.player.user_id)
    );
    
    if (eligibleHands.length === 0) continue;
    
    eligibleHands.sort((a, b) => {
      if (a.hand.rank !== b.hand.rank) return b.hand.rank - a.hand.rank;
      return compareKickers(b.hand.kickers, a.hand.kickers);
    });
    
    const bestHand = eligibleHands[0].hand;
    const winners = eligibleHands.filter(ph => 
      ph.hand.rank === bestHand.rank && 
      compareKickers(ph.hand.kickers, bestHand.kickers) === 0
    );
    
    // Distribute this side pot among winners, minus proportional fee
    const potAfterFee = sidePot.amount - Math.floor(feePerPot);
    const winAmount = Math.floor(potAfterFee / winners.length);
    
    for (const winner of winners) {
      const current = distributions.get(winner.player.id) || 0;
      distributions.set(winner.player.id, current + winAmount);
    }
  }
  
  return {
    distributions: Array.from(distributions.entries()).map(([playerId, amount]) => ({
      playerId,
      amount
    })),
    fee
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Please log in to continue', code: 'AUTH_REQUIRED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.substring(7);
    if (!token || token.length < 10) {
      return new Response(JSON.stringify({ error: 'Session expired. Please refresh the page.', code: 'INVALID_TOKEN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let user;
    try {
      const { data, error: userError } = await supabase.auth.getUser(token);
      if (userError || !data?.user) {
        console.log('Auth validation failed:', userError?.message || 'No user');
        return new Response(JSON.stringify({ error: 'Session expired. Please refresh the page.', code: 'SESSION_EXPIRED' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = data.user;
    } catch (authErr) {
      console.log('Auth error caught:', authErr);
      return new Response(JSON.stringify({ error: 'Authentication failed. Please refresh the page.', code: 'AUTH_ERROR' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, tableId, gameId, actionType, amount } = await req.json();
    console.log(`Action: ${action}, TableId: ${tableId}, UserId: ${user.id}`);

    if (action === 'start_hand') {
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

      const { data: currentGame } = await supabase
        .from('games')
        .select('dealer_position')
        .eq('table_id', tableId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const sortedPlayers = [...playersData].sort((a, b) => a.position - b.position);
      const numPlayers = sortedPlayers.length;

      let newDealerPosition: number;
      if (currentGame) {
        const prevDealerIdx = sortedPlayers.findIndex(p => p.position === currentGame.dealer_position);
        const nextIdx = prevDealerIdx === -1 ? 0 : (prevDealerIdx + 1) % numPlayers;
        newDealerPosition = sortedPlayers[nextIdx].position;
      } else {
        newDealerPosition = sortedPlayers[0].position;
      }

      const dealerIdx = sortedPlayers.findIndex(p => p.position === newDealerPosition);
      
      let sbIdx: number, bbIdx: number, firstToActIdx: number;
      
      if (numPlayers === 2) {
        sbIdx = dealerIdx;
        bbIdx = (dealerIdx + 1) % numPlayers;
        firstToActIdx = sbIdx;
      } else {
        sbIdx = (dealerIdx + 1) % numPlayers;
        bbIdx = (dealerIdx + 2) % numPlayers;
        firstToActIdx = (bbIdx + 1) % numPlayers;
      }

      const firstToActPosition = sortedPlayers[firstToActIdx].position;

      const deck = shuffleDeck(createDeck());
      let deckIndex = 0;

      const playerCards: Record<string, string[]> = {};
      for (const player of sortedPlayers) {
        const holeCards = [
          cardToString(deck[deckIndex++]),
          cardToString(deck[deckIndex++])
        ];
        playerCards[player.user_id] = holeCards;

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

      const communityCards = [];
      for (let i = 0; i < 5; i++) {
        communityCards.push(cardToString(deck[deckIndex++]));
      }

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

      await supabase
        .from('poker_tables')
        .update({ hands_played: tableData.hands_played + 1 })
        .eq('id', tableId);

      console.log(`Hand started. Table ${tableId}, Game ${newGame.id}, Hands played: ${tableData.hands_played + 1}`);

      return new Response(JSON.stringify({
        success: true,
        gameId: newGame.id,
        yourCards: playerCards[user.id] || [],
        handsPlayed: tableData.hands_played + 1,
        currentPlayerPosition: firstToActPosition,
        dealerPosition: newDealerPosition
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_my_cards') {
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

      const { data: currentPlayer } = await supabase
        .from('table_players')
        .select('*')
        .eq('table_id', tableId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!currentPlayer || currentPlayer.position !== game.current_player_position) {
        return new Response(JSON.stringify({ error: 'Not your turn', yourPosition: currentPlayer?.position, currentPosition: game.current_player_position }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

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

      // Update player state
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

      // Get all players for turn logic
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

      const updatedCurrentPlayer = { ...currentPlayer, stack: newStack, current_bet: newBet, is_folded: isFolded, is_all_in: isAllIn };
      const playersWithUpdated = allPlayers.map(p => p.id === currentPlayer.id ? updatedCurrentPlayer : p);
      
      const activePlayers = playersWithUpdated.filter(p => !p.is_folded);
      const sortedPlayers = [...playersWithUpdated].sort((a, b) => a.position - b.position);
      const numPlayers = sortedPlayers.filter(p => !p.is_folded).length;

      // Check if only one player left
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        const winnerStack = winner.id === currentPlayer.id ? newStack : winner.stack;
        
        const bigBlind = tableData.big_blind;
        const fee = calculateFee(newPot, bigBlind, game.status);
        const winnings = newPot - fee;
        
        if (fee > 0) {
          await supabase.from('collected_fees').insert({
            game_id: game.id,
            table_id: tableId,
            fee_amount: fee,
            pot_size: newPot,
            big_blind: bigBlind
          });
        }
        
        await supabase
          .from('games')
          .update({ status: 'complete', pot: 0, turn_expires_at: null, current_player_position: null })
          .eq('id', game.id);

        await supabase
          .from('table_players')
          .update({ stack: winnerStack + winnings, current_bet: 0 })
          .eq('id', winner.id);

        return new Response(JSON.stringify({
          success: true,
          status: 'complete',
          winner: winner.user_id,
          pot: newPot,
          fee: fee,
          nextPlayerPosition: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const dealerIdx = sortedPlayers.findIndex(p => p.position === game.dealer_position);
      const currentPlayerIdx = sortedPlayers.findIndex(p => p.position === currentPlayer.position);

      const { data: roundActions } = await supabase
        .from('game_actions')
        .select('user_id')
        .eq('game_id', game.id)
        .eq('round', game.status);

      const actedUserIds = new Set((roundActions || []).map(a => a.user_id));
      actedUserIds.add(user.id);

      // Find next player
      let nextPosition: number | null = null;
      
      for (let i = 1; i <= sortedPlayers.length; i++) {
        const idx = (currentPlayerIdx + i) % sortedPlayers.length;
        const p = sortedPlayers[idx];
        const playerBet = p.id === currentPlayer.id ? newBet : p.current_bet;
        const playerFolded = p.id === currentPlayer.id ? isFolded : p.is_folded;
        const playerAllIn = p.id === currentPlayer.id ? isAllIn : p.is_all_in;
        
        if (playerFolded || playerAllIn) continue;
        
        const hasActed = actedUserIds.has(p.user_id);
        const needsToMatch = playerBet < newCurrentBet;
        
        if (!hasActed || needsToMatch) {
          nextPosition = p.position;
          break;
        }
      }

      const activeNonAllIn = activePlayers.filter(p => {
        const isAllInNow = p.id === currentPlayer.id ? isAllIn : p.is_all_in;
        return !isAllInNow;
      });
      const allBetsEqual = activeNonAllIn.every(p => {
        const bet = p.id === currentPlayer.id ? newBet : p.current_bet;
        return bet === newCurrentBet;
      });

      const allPlayersAllIn = activeNonAllIn.length === 0;
      const onlyOneCanAct = activeNonAllIn.length === 1;
      
      const shouldSkipToShowdown = allPlayersAllIn || (onlyOneCanAct && allBetsEqual);
      const shouldAdvanceRound = (nextPosition === null && allBetsEqual) || shouldSkipToShowdown;

      if (shouldAdvanceRound) {
        // Reset bets for new round
        for (const p of playersWithUpdated) {
          if (!p.is_folded) {
            await supabase
              .from('table_players')
              .update({ current_bet: 0 })
              .eq('id', p.id);
          }
        }

        if (shouldSkipToShowdown) {
          console.log('All players all-in, skipping to showdown');
          
          const communityCards = (game.community_cards || []) as string[];
          
          // Use side pot distribution
          const { distributions, fee } = distributePotWithSidePots(
            playersWithUpdated,
            communityCards,
            newPot,
            tableData.big_blind,
            game.status
          );
          
          if (fee > 0) {
            await supabase.from('collected_fees').insert({
              game_id: game.id,
              table_id: tableId,
              fee_amount: fee,
              pot_size: newPot,
              big_blind: tableData.big_blind
            });
          }
          
          const winnerIds: string[] = [];
          for (const dist of distributions) {
            const player = playersWithUpdated.find(p => p.id === dist.playerId);
            if (player) {
              const playerStack = player.id === currentPlayer.id ? newStack : player.stack;
              await supabase
                .from('table_players')
                .update({ stack: playerStack + dist.amount })
                .eq('id', dist.playerId);
              winnerIds.push(player.user_id);
            }
          }

          const playerHands = activePlayers.map(p => ({
            userId: p.user_id,
            hand: evaluateHand(p.hole_cards || [], communityCards),
            cards: p.hole_cards
          }));

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
            pot: newPot,
            fee: fee,
            winners: [...new Set(winnerIds)],
            winningHand: playerHands[0]?.hand?.name,
            allIn: true,
            hands: playerHands.map(ph => ({
              userId: ph.userId,
              hand: ph.hand?.name || 'Unknown',
              cards: ph.cards
            })),
            nextPlayerPosition: null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Move to next round normally
        const roundOrder = ['preflop', 'flop', 'turn', 'river', 'showdown'];
        const currentIdx = roundOrder.indexOf(game.status);
        const nextRound = roundOrder[currentIdx + 1] || 'showdown';

        if (nextRound === 'showdown') {
          const communityCards = (game.community_cards || []) as string[];
          
          // Use side pot distribution
          const { distributions, fee } = distributePotWithSidePots(
            playersWithUpdated,
            communityCards,
            newPot,
            tableData.big_blind,
            'river'
          );
          
          if (fee > 0) {
            await supabase.from('collected_fees').insert({
              game_id: game.id,
              table_id: tableId,
              fee_amount: fee,
              pot_size: newPot,
              big_blind: tableData.big_blind
            });
          }
          
          const winnerIds: string[] = [];
          const winnerHands: { userId: string; hand: string }[] = [];

          for (const dist of distributions) {
            const player = playersWithUpdated.find(p => p.id === dist.playerId);
            if (player) {
              const playerStack = player.id === currentPlayer.id ? newStack : player.stack;
              await supabase
                .from('table_players')
                .update({ stack: playerStack + dist.amount })
                .eq('id', dist.playerId);
              
              const hand = evaluateHand(player.hole_cards || [], communityCards);
              winnerIds.push(player.user_id);
              winnerHands.push({ userId: player.user_id, hand: hand.name });
            }
          }

          const playerHands = activePlayers.map(p => ({
            userId: p.user_id,
            hand: evaluateHand(p.hole_cards || [], communityCards),
            cards: p.hole_cards
          }));

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
            pot: newPot,
            winners: [...new Set(winnerIds)],
            winningHand: winnerHands[0]?.hand,
            hands: playerHands.map(ph => ({
              userId: ph.userId,
              hand: ph.hand?.name || 'Unknown',
              cards: ph.cards
            })),
            nextPlayerPosition: null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // Find first player for new betting round
          let firstToAct: number | null = null;
          
          if (numPlayers === 2) {
            const nonDealerIdx = (dealerIdx + 1) % sortedPlayers.length;
            const bbPlayer = sortedPlayers[nonDealerIdx];
            if (!bbPlayer.is_folded && !bbPlayer.is_all_in) {
              firstToAct = bbPlayer.position;
            }
          }
          
          if (firstToAct === null) {
            for (let i = 1; i <= sortedPlayers.length; i++) {
              const idx = (dealerIdx + i) % sortedPlayers.length;
              const p = sortedPlayers[idx];
              if (!p.is_folded && !p.is_all_in) {
                firstToAct = p.position;
                break;
              }
            }
          }

          const turnExpiresAt = firstToAct !== null ? new Date(Date.now() + 30000).toISOString() : null;

          await supabase
            .from('games')
            .update({
              status: nextRound,
              pot: newPot,
              current_bet: 0,
              current_player_position: firstToAct,
              turn_expires_at: turnExpiresAt
            })
            .eq('id', game.id);

          return new Response(JSON.stringify({
            success: true,
            status: nextRound,
            nextPlayerPosition: firstToAct
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
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
        nextPlayerPosition: nextPosition
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'auto_fold') {
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

      if (new Date(game.turn_expires_at) > new Date()) {
        return new Response(JSON.stringify({ error: 'Turn not expired yet' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

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

      await supabase
        .from('table_players')
        .update({ is_folded: true })
        .eq('id', timedOutPlayer.id);

      await supabase
        .from('game_actions')
        .insert({
          game_id: game.id,
          user_id: timedOutPlayer.user_id,
          action_type: 'fold',
          amount: 0,
          round: game.status
        });

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

      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        await supabase
          .from('games')
          .update({ status: 'complete', pot: 0, turn_expires_at: null, current_player_position: null })
          .eq('id', game.id);

        await supabase
          .from('table_players')
          .update({ stack: winner.stack + game.pot, current_bet: 0 })
          .eq('id', winner.id);

        return new Response(JSON.stringify({
          success: true,
          status: 'complete',
          autoFolded: timedOutPlayer.user_id,
          winner: winner.user_id,
          nextPlayerPosition: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

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
        nextPlayerPosition: nextPosition
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
