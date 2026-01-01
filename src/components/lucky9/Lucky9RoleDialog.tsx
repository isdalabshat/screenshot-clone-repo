import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, User, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Lucky9Role } from '@/types/lucky9';

interface Lucky9RoleDialogProps {
  open: boolean;
  hasBanker: boolean;
  onSelectRole: (role: Lucky9Role) => void;
  onCancel: () => void;
  forceSpectator?: boolean;
  forceSpectatorReason?: 'balance' | 'full';
}

export function Lucky9RoleDialog({ open, hasBanker, onSelectRole, onCancel, forceSpectator = false, forceSpectatorReason = 'balance' }: Lucky9RoleDialogProps) {
  const spectatorMessage = forceSpectatorReason === 'full' 
    ? 'This table is full. You can watch the game as a spectator.'
    : 'Your balance is zero. You can watch the game as a spectator.';

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="text-2xl text-purple-400 flex items-center gap-2">
            <span>🎴</span> {forceSpectator ? 'Watch as Spectator' : 'Choose Your Role'}
          </DialogTitle>
          <DialogDescription>
            {forceSpectator 
              ? spectatorMessage
              : 'Select whether you want to be the Banker, Player, or Spectator'}
          </DialogDescription>
        </DialogHeader>

        {forceSpectator ? (
          <div className="py-4">
            <Button
              onClick={() => onSelectRole('spectator')}
              className="w-full h-20 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 flex items-center justify-center gap-3"
            >
              <Eye className="h-8 w-8 text-blue-400" />
              <span className="text-lg font-bold text-blue-300">Watch as Spectator</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 py-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                disabled={hasBanker}
                onClick={() => onSelectRole('banker')}
                className={`w-full h-32 flex flex-col gap-2 border-2 ${
                  hasBanker 
                    ? 'border-slate-600 opacity-50 cursor-not-allowed' 
                    : 'border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/10'
                }`}
              >
                <Crown className={`h-10 w-10 ${hasBanker ? 'text-slate-500' : 'text-amber-400'}`} />
                <span className={`text-lg font-bold ${hasBanker ? 'text-slate-500' : 'text-amber-400'}`}>Banker</span>
                <span className="text-[10px] text-muted-foreground">{hasBanker ? 'Taken' : 'vs Players'}</span>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                onClick={() => onSelectRole('player')}
                className="w-full h-32 flex flex-col gap-2 border-2 border-purple-500/50 hover:border-purple-500 hover:bg-purple-500/10"
              >
                <User className="h-10 w-10 text-purple-400" />
                <span className="text-lg font-bold text-purple-400">Player</span>
                <span className="text-[10px] text-muted-foreground">Bet vs Banker</span>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="col-span-2">
              <Button
                variant="outline"
                onClick={() => onSelectRole('spectator')}
                className="w-full h-14 flex items-center justify-center gap-2 border-2 border-slate-500/50 hover:border-blue-500 hover:bg-blue-500/10"
              >
                <Eye className="h-5 w-5 text-blue-400" />
                <span className="font-bold text-blue-400">Watch as Spectator</span>
              </Button>
            </motion.div>
          </div>
        )}

        <Button variant="ghost" onClick={onCancel} className="w-full text-slate-400 hover:text-white">
          Leave Table
        </Button>
      </DialogContent>
    </Dialog>
  );
}
