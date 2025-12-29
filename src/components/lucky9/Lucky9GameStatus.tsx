import { motion } from 'framer-motion';

interface Lucky9GameStatusProps {
  status: string;
  currentPlayerName?: string;
  message?: string;
}

export function Lucky9GameStatus({ status, currentPlayerName, message }: Lucky9GameStatusProps) {
  const getStatusMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'betting':
        return 'Waiting for all players to place their bets...';
      case 'dealing':
        return 'Dealing cards...';
      case 'player_turns':
        return currentPlayerName 
          ? `It is now ${currentPlayerName}'s turn.`
          : 'Waiting for player action...';
      case 'dealer_turn':
        return 'All players have finished. Dealer is now playing...';
      case 'showdown':
        return 'Comparing hands against the dealer...';
      case 'finished':
        return 'Round complete! Starting new round...';
      default:
        return 'Waiting...';
    }
  };

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-3 px-6 bg-slate-800/90 backdrop-blur rounded-lg border border-slate-600"
    >
      <p className="text-lg font-medium text-white">{getStatusMessage()}</p>
    </motion.div>
  );
}
