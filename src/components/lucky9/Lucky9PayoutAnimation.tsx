import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Coins } from 'lucide-react';

export interface PayoutAnimationData {
  id: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  amount: number;
  isWin: boolean; // true = banker paying player, false = player paying banker
  feeDeducted?: number;
}

interface Lucky9PayoutAnimationProps {
  payouts: PayoutAnimationData[];
  onComplete?: () => void;
}

const getChipColor = (amount: number) => {
  if (amount >= 1000) return 'from-amber-400 via-yellow-400 to-amber-500';
  if (amount >= 500) return 'from-green-400 to-green-600';
  if (amount >= 100) return 'from-blue-400 to-blue-600';
  return 'from-red-400 to-red-600';
};

export function Lucky9PayoutAnimation({ payouts, onComplete }: Lucky9PayoutAnimationProps) {
  const [activePayouts, setActivePayouts] = useState<PayoutAnimationData[]>([]);
  const [showingNet, setShowingNet] = useState<Record<string, boolean>>({});
  const processedPayoutIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (payouts.length > 0) {
      // Check if we already processed this exact payout set (prevent loops)
      const payoutKey = payouts.map(p => p.id).join(',');
      if (processedPayoutIds.current.has(payoutKey)) {
        return;
      }
      processedPayoutIds.current.add(payoutKey);
      
      setActivePayouts(payouts);
      setShowingNet({});
      
      // Show net amount after chips arrive
      const netTimer = setTimeout(() => {
        const netState: Record<string, boolean> = {};
        payouts.forEach(p => { netState[p.id] = true; });
        setShowingNet(netState);
      }, 800);

      const clearTimer = setTimeout(() => {
        setActivePayouts([]);
        setShowingNet({});
        onComplete?.();
      }, 2500);

      return () => {
        clearTimeout(netTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [payouts, onComplete]);
  
  // Clear processed IDs when payouts are cleared
  useEffect(() => {
    if (payouts.length === 0) {
      processedPayoutIds.current.clear();
    }
  }, [payouts]);

  return (
    <AnimatePresence>
      {activePayouts.map((payout, index) => {
        const chipCount = Math.min(6, Math.max(2, Math.ceil(payout.amount / 200)));
        const netAmount = payout.isWin 
          ? payout.amount - (payout.feeDeducted || 0) 
          : -payout.amount;
        
        return (
          <div key={payout.id} className="fixed inset-0 pointer-events-none z-50">
            {/* Flying chips */}
            {Array.from({ length: chipCount }).map((_, chipIndex) => {
              // Calculate arc path for chips
              const progress = chipIndex / chipCount;
              const arcHeight = -40 - (progress * 20);
              
              return (
                <motion.div
                  key={`${payout.id}-chip-${chipIndex}`}
                  className="absolute"
                  initial={{ 
                    x: payout.fromPosition.x - 14,
                    y: payout.fromPosition.y - 14,
                    scale: 0.4,
                    opacity: 0,
                    rotate: 0
                  }}
                  animate={{ 
                    x: [
                      payout.fromPosition.x - 14,
                      (payout.fromPosition.x + payout.toPosition.x) / 2 - 14 + (chipIndex * 3),
                      payout.toPosition.x - 14
                    ],
                    y: [
                      payout.fromPosition.y - 14,
                      (payout.fromPosition.y + payout.toPosition.y) / 2 + arcHeight,
                      payout.toPosition.y - 14
                    ],
                    scale: [0.4, 1.1, 1],
                    opacity: [0, 1, 1],
                    rotate: [0, 180 + chipIndex * 45, 360]
                  }}
                  transition={{ 
                    delay: (index * 0.1) + (chipIndex * 0.04),
                    duration: 0.7,
                    ease: [0.25, 0.46, 0.45, 0.94],
                    times: [0, 0.5, 1]
                  }}
                >
                  <motion.div 
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${getChipColor(payout.amount)} border-2 border-white/40 shadow-xl flex items-center justify-center`}
                    style={{ 
                      boxShadow: payout.isWin 
                        ? '0 0 15px rgba(34, 197, 94, 0.6), 0 4px 8px rgba(0,0,0,0.3)' 
                        : '0 0 15px rgba(239, 68, 68, 0.6), 0 4px 8px rgba(0,0,0,0.3)'
                    }}
                    animate={{ 
                      rotateY: [0, 360],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                      rotateY: { duration: 0.4, delay: (index * 0.1) + (chipIndex * 0.04) + 0.3 },
                      scale: { repeat: 2, duration: 0.2, delay: 0.7 }
                    }}
                  >
                    <div className="absolute inset-1 rounded-full border border-white/20" />
                    <Coins className="h-3 w-3 text-white/90" />
                  </motion.div>
                </motion.div>
              );
            })}
            
            {/* Net amount display at destination - without fee deduction visual */}
            <AnimatePresence>
              {showingNet[payout.id] && (
                <motion.div
                  initial={{ 
                    x: payout.toPosition.x,
                    y: payout.toPosition.y - 40,
                    opacity: 0,
                    scale: 0.5
                  }}
                  animate={{ 
                    y: payout.toPosition.y - 55,
                    opacity: 1,
                    scale: 1
                  }}
                  exit={{ 
                    y: payout.toPosition.y - 70,
                    opacity: 0
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute -translate-x-1/2"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: 2, duration: 0.3 }}
                    className={`px-2 py-1 rounded-lg font-black text-sm whitespace-nowrap shadow-xl ${
                      payout.isWin 
                        ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white' 
                        : 'bg-gradient-to-r from-red-600 to-rose-500 text-white'
                    }`}
                    style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}
                  >
                    {netAmount >= 0 ? '+' : ''}₱{Math.abs(netAmount).toLocaleString()}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </AnimatePresence>
  );
}

// Hook to manage payout animations
export function useLucky9PayoutAnimations() {
  const [payouts, setPayouts] = useState<PayoutAnimationData[]>([]);

  const triggerPayouts = (newPayouts: PayoutAnimationData[]) => {
    setPayouts(newPayouts);
  };

  const clearPayouts = () => {
    setPayouts([]);
  };

  return { payouts, triggerPayouts, clearPayouts };
}
