import { motion } from 'framer-motion';
import { Crown, Clock, Users, UserX } from 'lucide-react';

interface Lucky9GameStatusProps {
  status: string;
  currentPlayerName?: string;
  bankerName?: string;
  message?: string;
}

export function Lucky9GameStatus({ status, currentPlayerName, bankerName, message }: Lucky9GameStatusProps) {
  const getStatusMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'waiting_banker':
        return 'Waiting for a banker...';
      case 'waiting':
        return 'Waiting to start...';
      case 'betting':
        return 'Place your bets!';
      case 'dealing':
        return 'Dealing cards...';
      case 'player_turns':
        return currentPlayerName 
          ? `${currentPlayerName}'s turn`
          : 'Waiting for player...';
      case 'banker_turn':
        return bankerName ? `${bankerName} (Banker) is playing...` : 'Banker is playing...';
      case 'calculating':
        return 'Deciding winner...';
      case 'revealing':
        return '🃏 Showing all cards!';
      case 'showdown':
        return 'Showdown!';
      case 'finished':
        return 'Round complete!';
      default:
        return 'Waiting...';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'waiting_banker':
        return <UserX className="h-4 w-4 text-amber-400 animate-pulse" />;
      case 'betting':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'banker_turn':
        return <Crown className="h-4 w-4 text-amber-400" />;
      default:
        return <Users className="h-4 w-4 text-green-400" />;
    }
  };

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-center gap-1.5 py-1 px-3 bg-slate-900/95 backdrop-blur rounded-full border border-slate-600 mx-auto w-fit shadow-lg"
    >
      {getIcon()}
      <p className="text-xs font-medium text-white">{getStatusMessage()}</p>
    </motion.div>
  );
}
