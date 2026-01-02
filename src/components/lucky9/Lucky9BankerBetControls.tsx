import { Button } from '@/components/ui/button';
import { Lucky9Player } from '@/types/lucky9';
import { Check, X, Coins } from 'lucide-react';
import { motion } from 'framer-motion';

interface Lucky9BankerBetControlsProps {
  player: Lucky9Player;
  onAccept: (playerId: string) => void;
  onReject: (playerId: string) => void;
  disabled: boolean;
}

export function Lucky9BankerBetControls({ player, onAccept, onReject, disabled }: Lucky9BankerBetControlsProps) {
  // Don't show controls if no bet or already decided
  if (player.currentBet <= 0 || player.betAccepted !== null) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-1 mt-1"
    >
      {/* Bet amount display for banker */}
      <div className="flex items-center gap-1 bg-amber-900/80 px-2 py-0.5 rounded-full border border-amber-500/50">
        <Coins className="h-3 w-3 text-amber-400" />
        <span className="text-amber-300 font-bold text-xs">₱{player.currentBet.toLocaleString()}</span>
      </div>
      
      <div className="flex gap-1">
        <Button
          size="sm"
          onClick={() => onAccept(player.id)}
          disabled={disabled}
          className="h-6 px-2 bg-green-600 hover:bg-green-500 text-white text-[10px]"
        >
          <Check className="h-3 w-3 mr-0.5" />
          Accept
        </Button>
        <Button
          size="sm"
          onClick={() => onReject(player.id)}
          disabled={disabled}
          className="h-6 px-2 bg-red-600 hover:bg-red-500 text-white text-[10px]"
        >
          <X className="h-3 w-3 mr-0.5" />
          Reject
        </Button>
      </div>
    </motion.div>
  );
}
