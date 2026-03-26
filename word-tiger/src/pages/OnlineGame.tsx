import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, LogOut, Clock } from 'lucide-react';
import { useOnlineStore } from '@/hooks/use-online-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LetterGrid } from '@/components/game/LetterGrid';
import { cn } from '@/lib/utils';

const PLAYER_COLORS = [
  { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/30 text-orange-300 border-orange-500/50' },
  { bg: 'bg-blue-500/20',   border: 'border-blue-500',   text: 'text-blue-400',   badge: 'bg-blue-500/30 text-blue-300 border-blue-500/50'     },
];

export default function OnlineGame() {
  const [, setLocation] = useLocation();
  const store = useOnlineStore();
  const {
    status, puzzle, players, currentPlayerIndex, myPlayerIndex,
    foundWordEntries, foundWords, turnTimeLeft, message, roomCode,
  } = store;

  // ── All state and refs at top ──
  const [typedWord, setTypedWord] = useState('');
  const [wordsSort, setWordsSort] = useState<'recent' | 'alpha' | 'length'>('recent');
  const [flash, setFlash] = useState<{ letters: Set<string>; type: 'success' | 'error'; id: number } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const flashIdRef = useRef(0);
  const prevMessage = useRef(message);
  const lastSubmittedWord = useRef('');

  const isMyTurn = currentPlayerIndex === myPlayerIndex;
  const myColor = myPlayerIndex !== null ? PLAYER_COLORS[myPlayerIndex] : PLAYER_COLORS[0];

  // ── Effects ──
  useEffect(() => {
    if (status === 'idle') setLocation('/online-lobby');
  }, [status]);

  useEffect(() => {
    if (status === 'ended') setShowSummary(true);
  }, [status]);

  // Flash tiles when a word result arrives (use lastSubmittedWord since typedWord is already cleared)
  useEffect(() => {
    if (message && message !== prevMessage.current && lastSubmittedWord.current) {
      const letters = new Set(lastSubmittedWord.current.toLowerCase().replace(/[^a-z]/g, '').split(''));
      flashIdRef.current += 1;
      setFlash({ letters, type: message.type === 'success' ? 'success' : 'error', id: flashIdRef.current });
      setTimeout(() => setFlash(null), 700);
    }
    prevMessage.current = message;
  }, [message]);

  // ── Actions ──
  const handleSubmit = () => {
    const word = typedWord.trim();
    if (!word || !isMyTurn || status !== 'playing') return;
    lastSubmittedWord.current = word;
    store.submitWord(word);
    setTypedWord('');
  };

  // Keyboard input — letter keys, backspace, enter (only on my turn)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSummary || status !== 'playing' || !isMyTurn) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setTypedWord(prev => prev.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setTypedWord(prev => prev + e.key.toLowerCase());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMyTurn, status, showSummary, typedWord]);

  const requestEndGame = () => {
    store.endGame();
  };

  const timerPct = (turnTimeLeft / (store.turnTime || 60)) * 100;
  const timerColor = turnTimeLeft <= 5 ? 'text-red-400' : turnTimeLeft <= 10 ? 'text-amber-400' : 'text-foreground';

  if (!puzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading game…</p>
      </div>
    );
  }

  const pctComplete = foundWords.size > 0 ? (foundWords.size / puzzle.validWords.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">
            Room: <span className="font-bold text-primary tracking-widest">{roomCode}</span>
          </span>
          {isMyTurn ? (
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', myColor.badge)}>
              Your turn
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {players[currentPlayerIndex]?.name}'s turn…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          <span className={cn('text-sm font-display font-bold tabular-nums', timerColor)}>
            {turnTimeLeft}s
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={requestEndGame}
            className="h-8 text-xs"
            aria-label="End game"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            End Game
          </Button>
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 max-w-6xl mx-auto w-full">

        {/* CENTER — game input */}
        <main className="lg:col-span-8 flex flex-col items-center gap-4">

          {/* Turn indicator banner */}
          <div
            className={cn(
              'w-full text-center py-3 px-4 rounded-2xl border text-sm font-semibold transition-colors',
              isMyTurn
                ? cn(myColor.bg, myColor.border, myColor.text)
                : 'bg-secondary/50 border-border/30 text-muted-foreground',
            )}
            role="status"
            aria-live="polite"
          >
            {isMyTurn
              ? '🐯 Your turn — find a word!'
              : `⌛ Waiting for ${players[currentPlayerIndex]?.name}…`}
          </div>

          {/* Scores */}
          <div className="flex gap-3 w-full">
            {players.map((p, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-2xl p-3 border-2 flex items-center justify-between transition-colors',
                  currentPlayerIndex === i ? PLAYER_COLORS[i].bg : 'bg-secondary/30',
                  PLAYER_COLORS[i].border,
                )}
                aria-label={`${p.name}: ${p.score} points${i === currentPlayerIndex ? ', current turn' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', i === 0 ? 'bg-orange-400' : 'bg-blue-400')} aria-hidden="true" />
                  <span className="text-sm font-semibold truncate max-w-[80px]">{p.name}</span>
                  {i === myPlayerIndex && <span className="text-[10px] text-muted-foreground">(you)</span>}
                </div>
                <span className={cn('text-2xl font-display font-black', PLAYER_COLORS[i].text)}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>

          {/* Turn timer bar */}
          <div className="w-full" aria-label={`${turnTimeLeft} seconds remaining`}>
            <Progress
              value={timerPct}
              className={cn(
                'h-1.5 rounded-full transition-all',
                turnTimeLeft <= 5 ? '[&>div]:bg-red-500' : turnTimeLeft <= 10 ? '[&>div]:bg-amber-400' : '[&>div]:bg-primary',
              )}
            />
          </div>

          {/* Message */}
          <AnimatePresence mode="popLayout">
            {message && (
              <motion.div
                key={message.text + message.type}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'w-full text-center text-sm font-semibold py-2 px-4 rounded-xl border',
                  message.type === 'success' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                  message.type === 'error'   ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                              'bg-primary/10 text-primary border-primary/20',
                )}
                role="status"
                aria-live="polite"
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress */}
          <div className="flex justify-between text-xs text-muted-foreground w-full px-1">
            <span>{foundWords.size} found</span>
            <span>{puzzle.validWords.length - foundWords.size} remaining</span>
          </div>
          <Progress value={pctComplete} className="h-1.5 w-full rounded-full" />

          {/* Letter Grid */}
          <LetterGrid
            puzzle={puzzle}
            onLetterClick={letter => {
              if (isMyTurn && status === 'playing') setTypedWord(prev => prev + letter.toLowerCase());
            }}
            flash={flash}
          />

          {/* Word display + controls */}
          <div className="w-full flex flex-col items-center gap-3">
            <div
              className={cn(
                'w-full min-h-[60px] flex items-center justify-center rounded-2xl border-2 text-2xl font-display font-bold uppercase tracking-widest transition-colors px-4',
                typedWord
                  ? 'border-primary/60 text-foreground bg-primary/5'
                  : 'border-border/40 text-muted-foreground/50 bg-secondary/20',
                !isMyTurn && 'opacity-50 cursor-not-allowed',
              )}
              aria-label={typedWord ? `Current word: ${typedWord}` : 'Start typing a word'}
              role="textbox"
              aria-readonly={!isMyTurn}
            >
              {typedWord || (isMyTurn ? 'tap letters…' : '—')}
            </div>

            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 h-14 text-lg"
                onClick={() => setTypedWord(prev => prev.slice(0, -1))}
                disabled={!typedWord || !isMyTurn}
                aria-label="Delete last letter"
              >
                ⌫
              </Button>
              <Button
                className="flex-[2] h-14 text-lg font-semibold"
                onClick={handleSubmit}
                disabled={!typedWord.trim() || !isMyTurn || status !== 'playing'}
                aria-label="Submit word"
              >
                <Send className="w-5 h-5 mr-2" aria-hidden="true" />
                Submit
              </Button>
            </div>
          </div>
        </main>

        {/* RIGHT — Found Words */}
        <aside className="lg:col-span-4 flex flex-col gap-3" aria-label="Found words">
          <Card className="flex-1 flex flex-col min-h-[220px]">
            <CardHeader className="pb-2 border-b border-border/50 pt-4 px-4">
              <CardTitle className="text-base flex justify-between items-center gap-2">
                <span className="flex items-center gap-2">
                  Found Words
                  <span className="text-sm font-normal text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                    {foundWords.size}
                  </span>
                </span>
                <div role="group" aria-label="Sort found words" className="flex rounded-lg overflow-hidden border border-border/60 text-[10px] font-semibold shrink-0">
                  {(['recent', 'alpha', 'length'] as const).map(mode => {
                    const label = mode === 'recent' ? 'New' : mode === 'alpha' ? 'A–Z' : 'Len';
                    return (
                      <button
                        key={mode}
                        onClick={() => setWordsSort(mode)}
                        aria-pressed={wordsSort === mode}
                        className={cn(
                          'px-2 py-1 transition-colors',
                          wordsSort === mode
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </CardTitle>
              <div className="flex gap-3 mt-1 text-xs">
                {players.map((p, i) => (
                  <span key={i} className={cn('flex items-center gap-1.5 font-medium', PLAYER_COLORS[i].text)}>
                    <span className={cn('w-2 h-2 rounded-full', i === 0 ? 'bg-orange-400' : 'bg-blue-400')} aria-hidden="true" />
                    {p.name}: {foundWordEntries.filter(e => e.playerIndex === i).length}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative">
              <div className="absolute inset-0 overflow-y-auto p-3" role="list" aria-label="Words found so far">
                {foundWordEntries.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm">
                    No words yet
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(wordsSort === 'recent'
                      ? [...foundWordEntries].reverse()
                      : wordsSort === 'alpha'
                        ? [...foundWordEntries].sort((a, b) => a.word.localeCompare(b.word))
                        : [...foundWordEntries].sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word))
                    ).map((entry, idx) => (
                      <motion.div
                        key={entry.word + idx}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        role="listitem"
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium border shadow-sm uppercase tracking-wide',
                          PLAYER_COLORS[entry.playerIndex].badge,
                        )}
                      >
                        {entry.word}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ── SUMMARY MODAL ── */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Game over"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-5"
            >
              <h2 className="text-3xl font-display font-black text-primary">Game Over!</h2>

              <div className="space-y-3">
                {players.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-2xl border-2',
                      PLAYER_COLORS[i].bg, PLAYER_COLORS[i].border,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('font-semibold', PLAYER_COLORS[i].text)}>{p.name}</span>
                      {i === myPlayerIndex && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <span className={cn('text-2xl font-display font-black', PLAYER_COLORS[i].text)}>
                      {p.score}
                    </span>
                  </div>
                ))}
              </div>

              {/* Winner */}
              {players.length === 2 && (
                <p className="text-sm text-muted-foreground font-medium">
                  {players[0].score > players[1].score
                    ? `🏆 ${players[0].name} wins!`
                    : players[1].score > players[0].score
                      ? `🏆 ${players[1].name} wins!`
                      : "🤝 It's a tie!"}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                {foundWords.size} / {puzzle.validWords.length} words found
              </p>

              <Button
                className="w-full h-12"
                onClick={() => { store.reset(); setLocation('/'); }}
                aria-label="Return to home screen"
              >
                Back to Home
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
