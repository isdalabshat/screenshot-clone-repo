import { Card, CardSuit, CardRank } from '@/types/poker';

const SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
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

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

export function stringToCard(str: string): Card {
  const match = str.match(/^(\d{1,2}|[JQKA])([HDCS])$/i);
  if (!match) throw new Error(`Invalid card string: ${str}`);
  
  const rankMap: Record<string, CardRank> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
    'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
  };
  
  const suitMap: Record<string, CardSuit> = {
    'H': 'hearts', 'D': 'diamonds', 'C': 'clubs', 'S': 'spades'
  };
  
  return {
    rank: rankMap[match[1].toUpperCase()],
    suit: suitMap[match[2].toUpperCase()]
  };
}

export function dealCards(deck: Card[], count: number): { cards: Card[]; remainingDeck: Card[] } {
  const cards = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  return { cards, remainingDeck };
}
