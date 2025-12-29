export interface Lucky9Table {
  id: string;
  name: string;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
  isActive: boolean;
}

export interface Lucky9Game {
  id: string;
  tableId: string;
  status: 'betting' | 'dealing' | 'player_turns' | 'dealer_turn' | 'showdown' | 'finished';
  dealerCards: string[];
  dealerHiddenCard: string | null;
  currentPlayerPosition: number | null;
}

export interface Lucky9Player {
  id: string;
  tableId: string;
  gameId: string | null;
  userId: string;
  username: string;
  position: number;
  stack: number;
  currentBet: number;
  cards: string[];
  hasActed: boolean;
  hasStood: boolean;
  isNatural: boolean;
  result: 'win' | 'lose' | 'push' | 'natural_win' | null;
  winnings: number;
  isActive: boolean;
}

export type Lucky9Action = 'draw' | 'stand';
