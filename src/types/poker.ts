export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: CardSuit;
  rank: CardRank;
}

export interface Player {
  id: string;
  userId: string;
  username: string;
  position: number;
  stack: number;
  holeCards: Card[];
  hasHiddenCards?: boolean; // True if player has cards but they're hidden from viewer
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isActive: boolean;
  isSittingOut: boolean;
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  isCurrentPlayer?: boolean;
}

export interface PokerTable {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  handsPlayed: number;
  maxHands: number;
  isActive: boolean;
  playerCount?: number;
}

export interface Game {
  id: string;
  tableId: string;
  status: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';
  pot: number;
  communityCards: Card[];
  currentBet: number;
  dealerPosition: number;
  currentPlayerPosition: number | null;
  turnExpiresAt?: string | null;
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export interface GameAction {
  id: string;
  gameId: string;
  userId: string;
  actionType: ActionType;
  amount: number;
  round: string;
  createdAt: string;
}
