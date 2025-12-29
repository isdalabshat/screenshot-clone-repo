// Lucky 9 Deck - Only Ace through 10 (No J, Q, K)
const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export type Card = `${Rank}${Suit}`;

export function createLucky9Deck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getCardValue(card: string): number {
  const rank = card.slice(0, -1); // Remove suit
  if (rank === 'A') return 1;
  if (rank === '10') return 0;
  return parseInt(rank, 10);
}

export function calculateLucky9Value(cards: string[]): number {
  const total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
  return total % 10; // Only last digit matters
}

export function isNatural9(cards: string[]): boolean {
  return cards.length === 2 && calculateLucky9Value(cards) === 9;
}

export function parseCard(card: string): { rank: string; suit: string } {
  if (card.length === 3) {
    // 10 of something
    return { rank: '10', suit: card[2] };
  }
  return { rank: card[0], suit: card[1] };
}

export function getSuitColor(suit: string): string {
  return suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-slate-900';
}
