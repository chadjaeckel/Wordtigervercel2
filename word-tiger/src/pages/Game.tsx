import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, HelpCircle, Volume2, BookOpen,
  Keyboard, LogOut, Swords, Clock, AlertTriangle,
} from 'lucide-react';
import { useGameStore } from '@/hooks/use-game-store';
import { SpeechService } from '@/lib/speech';
import { formatTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LetterGrid } from '@/components/game/LetterGrid';
import { SummaryModal, RulesModal, ShortcutsModal } from '@/components/game/Modals';

const PLAYER_COLORS = [
  { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/30 text-orange-300 border-orange-500/50' },
  { bg: 'bg-blue-500/20',   border: 'border-blue-500',   text: 'text-blue-400',   badge: 'bg-blue-500/30 text-blue-300 border-blue-500/50'     },
];

export default function Game() {
  const [, setLocation] = useLocation();
  const store = useGameStore();
  const { status, puzzle, players, currentPlayerIndex, foundWordEntries, foundWords, elapsedSeconds, message, mode, turnTimeLeft } = store;

  const [typedWord, setTypedWord] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [modals, setModals] = useState({ summary: false, rules: false, shortcuts: false });
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [wordsSort, setWordsSort] = useState<'recent' | 'alpha' | 'length'>('recent');
  const [flash, setFlash] = useState<{ letters: Set<string>; type: 'success' | 'error'; id: number } | null>(null);
  const flashIdRef = useRef(0);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const srAnnouncerRef = useRef<HTMLDivElement>(null);

  const anyModalOpen = modals.summary || modals.rules || modals.shortcuts;

  const announce = (text: string) => {
    if (!srAnnouncerRef.current) return;
    srAnnouncerRef.current.textContent = '';
    setTimeout(() => { if (srAnnouncerRef.current) srAnnouncerRef.current.textContent = text; }, 50);
  };

  const requestEndGame = () => {
    setConfirmEnd(true);
    SpeechService.speak('Are you sure you want to end the game? Press 3 again to confirm, or Escape to cancel.');
    announce('End game confirmation: press 3 again to confirm, or Escape to cancel.');
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmEnd(false), 8000);
  };

  const confirmEndGame = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmEnd(false);
    store.endGame();
  };

  const cancelEndGame = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmEnd(false);
    SpeechService.speak('End game cancelled. Keep playing!');
    announce('End game cancelled. Keep playing!');
  };

  useEffect(() => {
    if (status !== 'playing' && status !== 'ended') setLocation('/');
  }, [status, setLocation]);

  useEffect(() => {
    const timer = setInterval(() => store.tickTimer(), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (anyModalOpen) return; // don't intercept keys while a modal is open

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack browser shortcuts or text in other inputs
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      const key = e.key.toLowerCase();

      if (key === 'escape') {
        if (confirmEnd) { cancelEndGame(); return; }
      }

      // ── Push-to-talk ────────────────────────────────────────────────────
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isListening && !SpeechService.getIsListening()) startSpeech();
        return;
      }

      // ── Word building — A-Z ─────────────────────────────────────────────
      if (/^[a-z]$/.test(key)) {
        e.preventDefault();
        // Shortcuts work when the word slate is empty; otherwise just append
        if (typedWord === '') {
          if (key === 's' && !confirmEnd) { store.readStatus(); return; }
          if (key === 'h' && !confirmEnd) { store.getHint(); return; }
          if (key === 'r' && !confirmEnd) { openModal('rules'); return; }
          if (key === 'k' && !confirmEnd) { openModal('shortcuts'); return; }
        }
        setTypedWord(prev => prev + key);
        return;
      }

      if (key === 'backspace') {
        e.preventDefault();
        setTypedWord(prev => prev.slice(0, -1));
        return;
      }

      if (key === 'enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // ── Number shortcuts ────────────────────────────────────────────────
      if (key === '2') { store.readLetters(); return; }
      if (key === '3') {
        if (confirmEnd) confirmEndGame();
        else requestEndGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') stopSpeech();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isListening, confirmEnd, typedWord, anyModalOpen]);

  useEffect(() => {
    if (status === 'ended') openModal('summary');
  }, [status]);

  useEffect(() => {
    if (message) announce(message.text);
  }, [message]);

  const triggerFlash = (word: string) => {
    const msg = useGameStore.getState().message;
    if (!msg || msg.type === 'info') return;
    const letters = new Set(word.toLowerCase().replace(/[^a-z]/g, '').split(''));
    flashIdRef.current += 1;
    setFlash({ letters, type: msg.type as 'success' | 'error', id: flashIdRef.current });
    setTimeout(() => setFlash(null), 700);
  };

  const handleSubmit = () => {
    const word = typedWord.trim();
    if (!word) return;
    store.submitWord(word);
    setTypedWord('');
    triggerFlash(word);
  };

  const deleteLetter = () => setTypedWord(prev => prev.slice(0, -1));

  const startSpeech = () => {
    setIsListening(true);
    SpeechService.speak('Listening…');
    SpeechService.startListening(
      (text) => { store.submitWord(text); setIsListening(false); triggerFlash(text); },
      () => setIsListening(false),
    );
  };

  const stopSpeech = () => {
    setIsListening(false);
    SpeechService.stopListening();
  };

  const openModal  = (type: keyof typeof modals) => setModals(prev => ({ ...prev, [type]: true  }));
  const closeModal = (type: keyof typeof modals) => setModals(prev => ({ ...prev, [type]: false }));

  if (!puzzle) return null;

  const pctComplete     = (foundWords.size / puzzle.validWords.length) * 100;
  const currentPlayer   = players[currentPlayerIndex];
  const isTwoPlayer     = mode === 'two';
  const turnPct         = (turnTimeLeft / 30) * 100;
  const turnUrgent      = turnTimeLeft <= 10;

  return (
    <div className="min-h-screen bg-background p-3 md:p-6 max-w-[1600px] mx-auto">

      {/* SR live regions */}
      <div ref={srAnnouncerRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" id="urgent-announcer" />

      {/* ─── TOP BAR ─── */}
      <header className="flex items-center justify-between mb-3 bg-card/50 px-3 py-2.5 rounded-2xl border border-border backdrop-blur-md">
        <nav className="flex gap-1.5" aria-label="Game controls">
          <Button variant="outline" size="sm" onClick={() => openModal('rules')} aria-label="Open rules" style={{ touchAction: 'manipulation' }}>
            <BookOpen className="w-4 h-4 mr-1" aria-hidden="true" />
            <span className="hidden sm:inline">Rules</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => openModal('shortcuts')} aria-label="Open keyboard shortcuts" style={{ touchAction: 'manipulation' }}>
            <Keyboard className="w-4 h-4 mr-1" aria-hidden="true" />
            <span className="hidden sm:inline">Keys</span>
          </Button>
        </nav>

        <time aria-label={`Elapsed time: ${formatTime(elapsedSeconds)}`} className="text-base font-bold text-muted-foreground tabular-nums">
          {formatTime(elapsedSeconds)}
        </time>

        <AnimatePresence mode="wait">
          {confirmEnd ? (
            <motion.div
              key="confirm" role="alertdialog" aria-label="Confirm end game"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5"
            >
              <span className="text-xs font-semibold text-amber-400 hidden sm:flex items-center gap-1" aria-hidden="true">
                <AlertTriangle className="w-3.5 h-3.5" /> Sure?
              </span>
              <Button variant="destructive" size="sm" onClick={confirmEndGame} aria-label="Yes, end the game now" style={{ touchAction: 'manipulation' }}>Yes, end</Button>
              <Button variant="outline"     size="sm" onClick={cancelEndGame}  aria-label="No, keep playing"     style={{ touchAction: 'manipulation' }}>No</Button>
            </motion.div>
          ) : (
            <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button variant="destructive" size="sm" onClick={requestEndGame} aria-label="End game" style={{ touchAction: 'manipulation' }}>
                <LogOut className="w-4 h-4 mr-1" aria-hidden="true" />
                <span className="hidden sm:inline">End</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HEAD-TO-HEAD SCOREBOARD ─── */}
      {isTwoPlayer && (
        <section aria-label="Player scores" className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          {players.map((p, i) => (
            <motion.div
              key={i}
              animate={{ scale: i === currentPlayerIndex ? 1.03 : 1, opacity: i === currentPlayerIndex ? 1 : 0.65 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              aria-label={`${p.name}: ${p.score} points, ${foundWordEntries.filter(e => e.playerIndex === i).length} words${i === currentPlayerIndex ? ', your turn' : ', waiting'}`}
              className={cn(
                'flex flex-col items-center p-2.5 rounded-2xl border-2 transition-shadow',
                PLAYER_COLORS[i].bg,
                i === currentPlayerIndex ? `${PLAYER_COLORS[i].border} shadow-lg` : 'border-border',
                i === 1 && 'order-3',
              )}
            >
              <span className={cn('text-[10px] font-semibold uppercase tracking-widest mb-0.5', PLAYER_COLORS[i].text)} aria-hidden="true">
                {i === currentPlayerIndex ? '▶ YOUR TURN' : 'WAITING'}
              </span>
              <span className="font-bold text-foreground truncate max-w-[100px] text-xs">{p.name}</span>
              <span className={cn('font-black text-3xl tabular-nums', PLAYER_COLORS[i].text)} aria-hidden="true">{p.score}</span>
              <span className="text-[10px] text-muted-foreground" aria-hidden="true">
                {foundWordEntries.filter(e => e.playerIndex === i).length} words
              </span>
            </motion.div>
          ))}

          <div className="flex flex-col items-center gap-1.5 order-2">
            <Swords className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <div
              aria-label={`Turn timer: ${turnTimeLeft} seconds remaining`}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full font-mono font-bold text-base tabular-nums border transition-colors',
                turnUrgent ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'bg-secondary border-border text-foreground',
              )}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span aria-hidden="true">{turnTimeLeft}s</span>
            </div>
            <div className="w-14 h-1.5 bg-secondary rounded-full overflow-hidden" role="presentation">
              <motion.div
                className={cn('h-full rounded-full', turnUrgent ? 'bg-red-500' : 'bg-primary')}
                animate={{ width: `${turnPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ─── SINGLE PLAYER SCOREBOARD ─── */}
      {!isTwoPlayer && (
        <div className="flex justify-between items-center mb-3 px-1" aria-label={`Score: ${players[0]?.score} points`}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-sm">{players[0]?.name}</span>
            <span className="font-black text-3xl text-primary tabular-nums" aria-label={`${players[0]?.score} points`}>{players[0]?.score}</span>
          </div>
          <div className="text-xs text-muted-foreground" aria-label={`${foundWords.size} of ${puzzle.validWords.length} words found`}>
            {foundWords.size} / {puzzle.validWords.length} words
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT — Game Area */}
        <main className="lg:col-span-8 flex flex-col gap-3">

          {/* Status Message */}
          <div className="h-10 flex items-center justify-center" aria-hidden="true">
            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  key={message.text + Date.now()}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className={cn(
                    'px-5 py-1.5 rounded-full font-bold text-sm tracking-wide',
                    message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                    message.type === 'error'   ? 'bg-red-500/20   text-red-400   border border-red-500/50'   :
                                                 'bg-blue-500/20  text-blue-400  border border-blue-500/50',
                  )}
                >
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground px-1" aria-hidden="true">
              <span>{foundWords.size} found</span>
              <span>{Math.round(pctComplete)}% complete</span>
              <span>{puzzle.validWords.length - foundWords.size} remaining</span>
            </div>
            <Progress
              value={pctComplete}
              className="h-2"
              aria-label={`Progress: ${foundWords.size} of ${puzzle.validWords.length} words found, ${Math.round(pctComplete)}% complete`}
            />
          </div>

          {/* Turn Indicator (two-player) */}
          {isTwoPlayer && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPlayerIndex}
                initial={{ opacity: 0, x: currentPlayerIndex === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-center"
                aria-live="polite" aria-atomic="true"
              >
                <div className={cn(
                  'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-bold text-sm',
                  PLAYER_COLORS[currentPlayerIndex].bg,
                  PLAYER_COLORS[currentPlayerIndex].border,
                  PLAYER_COLORS[currentPlayerIndex].text,
                )}>
                  ▶ {currentPlayer?.name}'s Turn
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Letter Grid */}
          <LetterGrid puzzle={puzzle} onLetterClick={(letter) => setTypedWord(prev => prev + letter.toLowerCase())} flash={flash} />

          {/* ─── WORD DISPLAY + DELETE + SUBMIT ─── */}
          {/*
            No native <input> here — the mobile keyboard never appears.
            Letters come from grid taps or physical keyboard (global keydown above).
          */}
          <div className="flex gap-2 max-w-sm mx-auto w-full">
            {/* Word display */}
            <div
              role="status"
              aria-live="polite"
              aria-label={typedWord ? `Current word: ${typedWord.toUpperCase()}` : 'No letters entered yet'}
              className={cn(
                'flex-1 h-14 flex items-center justify-center rounded-xl border-2 bg-card shadow-inner',
                'text-2xl font-mono font-bold uppercase tracking-widest select-none',
                typedWord ? 'border-primary text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              {typedWord
                ? <span>{typedWord}<span className="animate-pulse opacity-70">|</span></span>
                : <span className="text-sm font-sans font-normal tracking-normal">Tap letters…</span>
              }
            </div>

            {/* Delete last letter */}
            <Button
              type="button"
              variant="outline"
              className="h-14 w-14 p-0 rounded-xl shrink-0 text-xl"
              onClick={deleteLetter}
              disabled={!typedWord}
              aria-label="Delete last letter"
              style={{ touchAction: 'manipulation' }}
            >
              ⌫
            </Button>

            {/* Submit */}
            <Button
              type="button"
              className="h-14 w-14 p-0 rounded-xl shrink-0"
              onClick={handleSubmit}
              disabled={!typedWord}
              aria-label="Submit word"
              style={{ touchAction: 'manipulation' }}
            >
              <Send className="w-5 h-5" aria-hidden="true" />
            </Button>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Game controls">
            <Button
              variant={isListening ? 'destructive' : 'default'}
              size="lg"
              className="rounded-full h-11 px-5 text-sm"
              onPointerDown={startSpeech}
              onPointerUp={stopSpeech}
              onPointerLeave={stopSpeech}
              aria-label={isListening ? 'Listening — release to stop' : 'Hold to speak your word (or hold Spacebar)'}
              aria-pressed={isListening}
              style={{ touchAction: 'none' }}   /* needed so pointerDown fires on mobile without scroll */
            >
              {isListening
                ? <><MicOff className="w-4 h-4 mr-1.5 animate-pulse" aria-hidden="true" /> Listening…</>
                : <><Mic    className="w-4 h-4 mr-1.5"               aria-hidden="true" /> Hold to Talk</>}
            </Button>

            <Button
              variant="secondary" size="lg" className="h-11 rounded-full text-sm"
              onClick={() => store.readLetters()}
              aria-label="Read all letters aloud (press 2)"
              style={{ touchAction: 'manipulation' }}
            >
              <Volume2 className="w-4 h-4 mr-1.5" aria-hidden="true" /> Letters
            </Button>

            <Button
              variant="outline" size="lg" className="h-11 rounded-full text-sm"
              onClick={() => store.readStatus()}
              aria-label="Read game status aloud (press S)"
              style={{ touchAction: 'manipulation' }}
            >
              <Volume2 className="w-4 h-4 mr-1.5" aria-hidden="true" /> Status
            </Button>

            <Button
              variant="outline" size="lg" className="h-11 rounded-full text-sm"
              onClick={() => store.getHint()}
              aria-label="Get a hint (press H)"
              style={{ touchAction: 'manipulation' }}
            >
              <HelpCircle className="w-4 h-4 mr-1.5" aria-hidden="true" /> Hint
            </Button>
          </div>
        </main>

        {/* RIGHT — Found Words */}
        <aside className="lg:col-span-4 flex flex-col gap-3" aria-label="Found words">
          <Card className="flex-1 flex flex-col min-h-[260px] lg:min-h-[350px]">
            <CardHeader className="pb-2 border-b border-border/50 pt-4 px-4">
              <CardTitle className="text-base flex justify-between items-center gap-2">
                <span className="flex items-center gap-2">
                  Found Words
                  <span className="text-sm font-normal text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full" aria-label={`${foundWords.size} words found`}>
                    {foundWords.size}
                  </span>
                </span>
                {/* Sort toggle */}
                <div
                  role="group"
                  aria-label="Sort found words"
                  className="flex rounded-lg overflow-hidden border border-border/60 text-[10px] font-semibold shrink-0"
                >
                  {(['recent', 'alpha', 'length'] as const).map((mode) => {
                    const label = mode === 'recent' ? 'New' : mode === 'alpha' ? 'A–Z' : 'Len';
                    const ariaLabel = mode === 'recent' ? 'Newest first' : mode === 'alpha' ? 'Alphabetical' : 'Longest first';
                    return (
                      <button
                        key={mode}
                        onClick={() => setWordsSort(mode)}
                        aria-pressed={wordsSort === mode}
                        aria-label={ariaLabel}
                        className={cn(
                          'px-2 py-1 transition-colors',
                          wordsSort === mode
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </CardTitle>
              {isTwoPlayer && (
                <div className="flex gap-3 mt-1 text-xs" aria-label="Words per player">
                  {players.map((p, i) => (
                    <span key={i} className={cn('flex items-center gap-1.5 font-medium', PLAYER_COLORS[i].text)}>
                      <span className={cn('w-2 h-2 rounded-full inline-block', i === 0 ? 'bg-orange-400' : 'bg-blue-400')} aria-hidden="true" />
                      {p.name}: {foundWordEntries.filter(e => e.playerIndex === i).length}
                    </span>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0 relative">
              <div
                className="absolute inset-0 overflow-y-auto p-3 custom-scrollbar"
                role="list"
                aria-label={`Words found so far, sorted by ${wordsSort === 'recent' ? 'most recent' : wordsSort === 'alpha' ? 'alphabetical order' : 'word length'}`}
                aria-live="polite"
                aria-relevant="additions"
              >
                {foundWordEntries.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm">
                    No words found yet
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
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={entry.word + idx}
                        role="listitem"
                        aria-label={isTwoPlayer ? `${entry.word}, found by ${players[entry.playerIndex]?.name}` : entry.word}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium border shadow-sm uppercase tracking-wide',
                          isTwoPlayer ? PLAYER_COLORS[entry.playerIndex].badge : 'bg-secondary text-foreground border-border/50',
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

      {/* Modals */}
      <SummaryModal   isOpen={modals.summary}   onClose={() => closeModal('summary')}   />
      <RulesModal     isOpen={modals.rules}     onClose={() => closeModal('rules')}     />
      <ShortcutsModal isOpen={modals.shortcuts} onClose={() => closeModal('shortcuts')} />
    </div>
  );
}
