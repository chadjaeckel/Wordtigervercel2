import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Play, Users, User, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGameStore, GameMode } from '@/hooks/use-game-store';

export default function Home() {
  const [, setLocation] = useLocation();
  const { status, initialize, startGame } = useGameStore();

  const [mode, setMode] = useState<GameMode>('single');
  const [p1, setP1] = useState('Player 1');
  const [p2, setP2] = useState('Player 2');

  useEffect(() => {
    if (status === 'loading') {
      initialize();
    }
  }, [status, initialize]);

  const handleStart = () => {
    startGame(mode, p1, p2);
    setLocation('/game');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.currentTarget === e.target) {
      handleStart();
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" aria-hidden="true" />
        <p className="text-xl font-display font-medium text-foreground">Loading Dictionary…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 z-[-1] opacity-30 mix-blend-screen bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/tiger-bg.png)` }}
        aria-hidden="true"
      />

      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8 rounded-[2rem] text-center"
        aria-label="Word Tiger game setup"
      >
        <div className="flex justify-center mb-6" aria-hidden="true">
          <img
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
            alt=""
            className="w-24 h-24 drop-shadow-[0_0_15px_rgba(255,140,0,0.5)]"
          />
        </div>

        <h1 className="text-5xl font-display font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600">
          WORD TIGER
        </h1>
        <p className="text-muted-foreground mb-8">Hunt for words. Conquer the grid.</p>

        <div className="space-y-6 text-left">
          <fieldset className="space-y-3 border-0 p-0 m-0">
            <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Game Mode</legend>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select game mode">
              <Button
                variant={mode === 'single' ? 'default' : 'outline'}
                onClick={() => setMode('single')}
                aria-pressed={mode === 'single'}
                aria-label="Single player mode"
                className="w-full h-14"
              >
                <User className="w-5 h-5 mr-2" aria-hidden="true" /> Single
              </Button>
              <Button
                variant={mode === 'two' ? 'default' : 'outline'}
                onClick={() => setMode('two')}
                aria-pressed={mode === 'two'}
                aria-label="Two player versus mode, same device"
                className="w-full h-14"
              >
                <Users className="w-5 h-5 mr-2" aria-hidden="true" /> Versus
              </Button>
            </div>
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation('/online-lobby')}
              aria-label="Online versus mode — play with someone on a separate device"
              className="w-full h-14 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
            >
              <Globe className="w-5 h-5 mr-2" aria-hidden="true" /> Online Versus
            </Button>
          </fieldset>

          <div className="space-y-4">
            <div>
              <label htmlFor="player1-name" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Player 1 Name
              </label>
              <Input
                id="player1-name"
                value={p1}
                onChange={e => setP1(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter name…"
                className="h-14 text-lg"
                autoComplete="given-name"
              />
            </div>

            {mode === 'two' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label htmlFor="player2-name" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Player 2 Name
                </label>
                <Input
                  id="player2-name"
                  value={p2}
                  onChange={e => setP2(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter name…"
                  className="h-14 text-lg"
                  autoComplete="given-name"
                />
              </motion.div>
            )}
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-xl rounded-2xl mt-4"
            onClick={handleStart}
            aria-label={`Start ${mode === 'single' ? 'single player' : 'two player versus'} game as ${p1}${mode === 'two' ? ` vs ${p2}` : ''}`}
          >
            <Play className="w-6 h-6 mr-2 fill-current" aria-hidden="true" /> START GAME
          </Button>
        </div>
      </motion.main>
    </div>
  );
}
