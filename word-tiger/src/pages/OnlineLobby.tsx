import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Wifi, WifiOff, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOnlineStore } from '@/hooks/use-online-store';
import { cn } from '@/lib/utils';

const PLAYER_COLORS = [
  { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400' },
  { bg: 'bg-blue-500/20',   border: 'border-blue-500',   text: 'text-blue-400'   },
];

export default function OnlineLobby() {
  const [, setLocation] = useLocation();
  const store = useOnlineStore();

  const [view, setView] = useState<'choose' | 'host' | 'join'>('choose');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [turnDuration, setTurnDuration] = useState(60);

  const DURATION_OPTIONS = [
    { value: 30,  label: '30s' },
    { value: 60,  label: '1 min' },
    { value: 90,  label: '1:30' },
    { value: 120, label: '2 min' },
    { value: 180, label: '3 min' },
  ];

  // Connect the socket as soon as the lobby mounts
  useEffect(() => {
    store.connect();
  }, []);

  // Navigate to the game once it starts playing
  useEffect(() => {
    if (store.status === 'playing') {
      setLocation('/online-game');
    }
  }, [store.status]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    store.createRoom(playerName.trim(), turnDuration);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    store.joinRoom(joinCode.trim(), playerName.trim());
  };

  const copyCode = () => {
    if (!store.roomCode) return;
    navigator.clipboard.writeText(store.roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 z-[-1] opacity-20 mix-blend-screen bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/tiger-bg.png)` }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { store.reset(); setLocation('/'); }}
          className="mb-4 text-muted-foreground hover:text-foreground"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        {/* Connection status banner */}
        <div
          className={cn(
            'flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-4 w-fit',
            store.connectionStatus === 'connected'
              ? 'bg-green-500/15 text-green-400'
              : store.connectionStatus === 'error'
                ? 'bg-red-500/15 text-red-400'
                : 'bg-secondary text-muted-foreground',
          )}
          role="status"
          aria-live="polite"
        >
          {store.connectionStatus === 'connected'
            ? <><Wifi className="w-3 h-3" /> Connected</>
            : store.connectionStatus === 'error'
              ? <><WifiOff className="w-3 h-3" /> Connection failed</>
              : <><Loader2 className="w-3 h-3 animate-spin" /> Connecting…</>
          }
        </div>

        <Card className="glass-panel">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-display flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" aria-hidden="true" />
              Online Versus
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Play with someone on another device in the same room.
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error */}
            <AnimatePresence>
              {store.error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2"
                  role="alert"
                >
                  {store.error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── CHOOSE ── */}
            {view === 'choose' && (
              <motion.div
                key="choose"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <Button
                  className="w-full h-14 text-base"
                  onClick={() => setView('host')}
                  aria-label="Host a new game"
                >
                  🐯 Host a Game
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-14 text-base"
                  onClick={() => setView('join')}
                  aria-label="Join an existing game with a room code"
                >
                  Join with Code
                </Button>
              </motion.div>
            )}

            {/* ── HOST ── */}
            {view === 'host' && (
              <motion.div
                key="host"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {store.status === 'idle' || !store.roomCode ? (
                  <>
                    <div>
                      <label htmlFor="host-name" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Your Name
                      </label>
                      <Input
                        id="host-name"
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                        placeholder="Enter your name…"
                        className="h-14 text-lg"
                        autoComplete="given-name"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Turn Duration
                      </label>
                      <div className="flex gap-2 flex-wrap" role="group" aria-label="Turn duration options">
                        {DURATION_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTurnDuration(opt.value)}
                            aria-pressed={turnDuration === opt.value}
                            className={cn(
                              'flex-1 min-w-0 h-10 rounded-lg text-sm font-semibold border transition-colors',
                              turnDuration === opt.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      className="w-full h-14"
                      onClick={handleCreateRoom}
                      disabled={!playerName.trim() || store.connectionStatus !== 'connected'}
                      aria-label="Create a new game room"
                    >
                      {store.connectionStatus !== 'connected'
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</>
                        : 'Create Room'
                      }
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setView('choose')}>
                      ← Back
                    </Button>
                  </>
                ) : (
                  /* Waiting for opponent */
                  <div className="space-y-5 text-center">
                    <p className="text-muted-foreground text-sm">Share this code with your opponent:</p>

                    <div className="relative">
                      <div
                        className="text-6xl font-display font-black tracking-[0.25em] text-primary py-4 px-6 bg-primary/10 rounded-2xl border-2 border-primary/30 select-all"
                        role="text"
                        aria-label={`Room code: ${store.roomCode}`}
                      >
                        {store.roomCode}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={copyCode}
                        className="absolute top-2 right-2 h-8 gap-1.5 text-xs"
                        aria-label="Copy room code to clipboard"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span className="text-sm">Waiting for opponent to join…</span>
                    </div>

                    {/* Player 1 chip */}
                    <div className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium mx-auto w-fit',
                      PLAYER_COLORS[0].bg, PLAYER_COLORS[0].border, PLAYER_COLORS[0].text,
                    )}>
                      <span className="w-2 h-2 rounded-full bg-orange-400" aria-hidden="true" />
                      {store.players[0]?.name ?? playerName} (you)
                    </div>

                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => { store.reset(); setView('choose'); }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── JOIN ── */}
            {view === 'join' && (
              <motion.div
                key="join"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="join-name" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Your Name
                  </label>
                  <Input
                    id="join-name"
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    placeholder="Enter your name…"
                    className="h-14 text-lg"
                    autoComplete="given-name"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="join-code" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Room Code
                  </label>
                  <Input
                    id="join-code"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                    placeholder="e.g. ABCD"
                    className="h-14 text-lg tracking-[0.3em] uppercase font-display font-bold text-center"
                    maxLength={4}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  className="w-full h-14"
                  onClick={handleJoinRoom}
                  disabled={!playerName.trim() || joinCode.length !== 4 || store.connectionStatus !== 'connected'}
                  aria-label="Join the game room"
                >
                  Join Game
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setView('choose')}>
                  ← Back
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
