import { Card } from '@/types/poker';

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

export interface HandResult {
  rank: number;
  name: string;
  kickers: number[];
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

function checkStraight(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => b - a);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] - sorted[i + 1] !== 1) return false;
  }
  return true;
}

function evaluateFiveCards(cards: Card[]): HandResult {
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

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  
  // If not enough cards, just evaluate what we have
  if (allCards.length < 5) {
    if (allCards.length === 0) return { rank: 0, name: '', kickers: [] };
    
    // Evaluate partial hand (just for display purposes)
    const values = allCards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
    const suits = allCards.map(c => c.suit);
    
    const counts: Record<number, number> = {};
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    
    if (maxCount >= 2) {
      return { rank: HAND_RANKS.PAIR, name: 'Pair', kickers: values };
    }
    
    // Check for potential flush draw
    const suitCounts: Record<string, number> = {};
    for (const s of suits) {
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    }
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    
    if (maxSuitCount >= 2 && holeCards.length === 2 && holeCards[0].suit === holeCards[1].suit) {
      return { rank: HAND_RANKS.HIGH_CARD, name: 'Suited', kickers: values };
    }
    
    return { rank: HAND_RANKS.HIGH_CARD, name: 'High Card', kickers: values };
  }
  
  const combinations = getCombinations(allCards, 5);
  let bestHand: HandResult = { rank: 0, name: 'High Card', kickers: [0] };
  
  for (const combo of combinations) {
    const hand = evaluateFiveCards(combo);
    if (hand.rank > bestHand.rank || 
        (hand.rank === bestHand.rank && compareKickers(hand.kickers, bestHand.kickers) > 0)) {
      bestHand = hand;
    }
  }
  
  return bestHand;
}

function compareKickers(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
