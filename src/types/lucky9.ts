export interface Lucky9Table {
  id: string;
  name: string;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
  isActive: boolean;
  betTimerSeconds: number;
}

export interface Lucky9Game {
  id: string;
  tableId: string;
  status: 'betting' | 'accepting_bets' | 'dealing' | 'player_turns' | 'banker_turn' | 'calculating' | 'revealing' | 'showdown' | 'finished';
  bankerCards: string[];
  bankerHiddenCard: string | null;
  currentPlayerPosition: number | null;
  bettingEndsAt: string | null;
  bankerId: string | null;
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
  isBanker: boolean;
  betAccepted: boolean | null;
}

export type Lucky9Action = 'draw' | 'stand';
export type Lucky9Role = 'banker' | 'player';
