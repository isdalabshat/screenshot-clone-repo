import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Coins, LogOut, Shield, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { CashInOutButtons } from '@/components/CashInOutButtons';

export default function Index() {
  const navigate = useNavigate();
  const { user, profile, signOut, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-green-950 to-slate-950">
        <div className="animate-pulse text-xl text-green-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950 to-slate-950 overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-green-500/30 rounded-full"
            initial={{ 
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), 
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              y: [null, -20, 20],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ 
              duration: 3 + Math.random() * 2, 
              repeat: Infinity, 
              repeatType: "reverse" 
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="border-b border-green-500/20 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <motion.div 
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="text-4xl"
            >
              🃏
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-green-500 bg-clip-text text-transparent">
                JD Club
              </h1>
              <p className="text-xs text-green-400/60">Premium Casino</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-xl border border-yellow-500/40 shadow-lg shadow-yellow-500/10">
              <Coins className="h-5 w-5 text-yellow-400" />
              <span className="font-bold text-yellow-400">₱{profile.chips.toLocaleString()}</span>
            </div>
            
            {/* Cash In/Out Buttons */}
            {user && <CashInOutButtons userId={user.id} userChips={profile.chips} />}
            
            <span className="text-green-300/80 text-sm hidden sm:block">{profile.username}</span>
            {profile.isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin')}
                className="text-amber-400 hover:bg-amber-500/10"
              >
                <Shield className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-green-400/70 hover:text-green-400">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Game
          </h2>
          <p className="text-green-400/60 text-lg">Select a game to start playing</p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Texas Hold'em Card */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="group cursor-pointer"
            onClick={() => navigate('/lobby')}
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-green-500/30 p-8 h-full shadow-2xl shadow-green-500/10 hover:border-green-400/50 transition-all duration-300">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Card icons decoration */}
              <div className="absolute top-4 right-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity">
                ♠️♥️
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-3xl shadow-lg shadow-green-500/30">
                    🃏
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Texas Hold'em</h3>
                    <p className="text-green-400/60">Classic Poker</p>
                  </div>
                </div>
                
                <p className="text-slate-400 mb-6">
                  The most popular poker variant. Play against other players, bluff your way to victory!
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-sm">Multiplayer</span>
                    <span className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-400 text-sm">Strategy</span>
                  </div>
                  <Button className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-lg shadow-green-500/30">
                    Play Now
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Lucky 9 Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="group cursor-pointer"
            onClick={() => navigate('/lucky9')}
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-900 border border-purple-500/30 p-8 h-full shadow-2xl shadow-purple-500/10 hover:border-purple-400/50 transition-all duration-300">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Lucky 9 decoration */}
              <div className="absolute top-4 right-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity font-bold text-purple-400">
                9
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30">
                    🎴
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Lucky 9</h3>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm">Filipino Card Game</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-slate-400 mb-6">
                  Get as close to 9 as possible. Face off against the banker in this thrilling game of chance!
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-purple-500/20 rounded-full text-purple-400 text-sm">Fast-paced</span>
                    <span className="px-3 py-1 bg-amber-500/20 rounded-full text-amber-400 text-sm">High Stakes</span>
                  </div>
                  <Button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-lg shadow-purple-500/30">
                    Play Now
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom decorative element */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-slate-600 text-sm">
            Play responsibly • 18+ only
          </p>
        </motion.div>
      </main>
    </div>
  );
}
