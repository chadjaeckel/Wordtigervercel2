import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, AlertCircle, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/hooks/use-game-store';
import { SpeechService } from '@/lib/speech';
import { formatTime } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
}

const Modal = ({ isOpen, onClose, title, children, icon, description }: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Save what had focus before we opened
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the dialog itself so screen readers announce the title
      setTimeout(() => {
        const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 100);
    } else {
      // Return focus to wherever it was before
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Trap focus inside the dialog
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="presentation"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby={description ? "modal-description" : undefined}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-50 w-full max-w-lg overflow-hidden rounded-3xl bg-card border border-border shadow-2xl"
        >
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 text-primary">
                {icon && <span aria-hidden="true">{icon}</span>}
                <h2 id="modal-title" className="text-2xl font-display font-bold text-foreground">{title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>
            {description && (
              <p id="modal-description" className="sr-only">{description}</p>
            )}
            <div className="text-muted-foreground">
              {children}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const SummaryModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { players, puzzle, foundWords, foundWordEntries, elapsedSeconds, mode } = useGameStore();

  if (!puzzle) return null;

  const isTwoPlayer = mode === 'two' && players.length === 2;
  const winner = isTwoPlayer
    ? players[0].score > players[1].score ? players[0]
      : players[1].score > players[0].score ? players[1]
      : null
    : null;

  const summaryDescription = isTwoPlayer
    ? winner
      ? `${winner.name} wins with ${winner.score} points! ${foundWords.size} of ${puzzle.validWords.length} words found.`
      : `It's a tie! ${foundWords.size} of ${puzzle.validWords.length} words found.`
    : `You scored ${players[0]?.score ?? 0} points and found ${foundWords.size} of ${puzzle.validWords.length} words in ${formatTime(elapsedSeconds)}.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Game Over!"
      icon={<Trophy className="w-6 h-6" />}
      description={summaryDescription}
    >
      <div className="space-y-5">

        {/* Winner banner (two-player) */}
        {isTwoPlayer && (
          <div
            className={`rounded-2xl p-4 text-center border ${winner ? 'bg-primary/20 border-primary' : 'bg-secondary border-border'}`}
            aria-label={winner ? `${winner.name} wins with ${winner.score} points` : "It's a tie!"}
          >
            {winner ? (
              <>
                <div className="text-3xl mb-1" aria-hidden="true">🏆</div>
                <div className="text-lg font-bold text-primary">{winner.name} Wins!</div>
                <div className="text-sm text-muted-foreground">{winner.score} points</div>
              </>
            ) : (
              <>
                <div className="text-3xl mb-1" aria-hidden="true">🤝</div>
                <div className="text-lg font-bold text-foreground">It's a Tie!</div>
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-xl p-3 text-center" aria-label={`Time: ${formatTime(elapsedSeconds)}`}>
            <div className="text-xs font-medium text-muted-foreground mb-1" aria-hidden="true">Time</div>
            <div className="text-xl font-bold text-foreground" aria-hidden="true">{formatTime(elapsedSeconds)}</div>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center" aria-label={`${foundWords.size} of ${puzzle.validWords.length} words found`}>
            <div className="text-xs font-medium text-muted-foreground mb-1" aria-hidden="true">Words Found</div>
            <div className="text-xl font-bold text-primary" aria-hidden="true">{foundWords.size} / {puzzle.validWords.length}</div>
          </div>
        </div>

        {/* Final Scores */}
        <div className="space-y-2">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Final Scores</h3>
          <ul aria-label="Final scores">
            {players.map((p, i) => {
              const wordsCount = foundWordEntries.filter(e => e.playerIndex === i).length;
              const isWinner = winner === p;
              return (
                <li
                  key={i}
                  className={`flex justify-between items-center rounded-xl p-3 border mt-2 ${isWinner ? 'bg-primary/10 border-primary' : 'bg-background border-border'}`}
                  aria-label={`${p.name}: ${p.score} points${isTwoPlayer ? `, ${wordsCount} words` : ''}${isWinner ? ', winner' : ''}`}
                >
                  <div>
                    <span className="font-semibold text-foreground">{p.name}</span>
                    {isTwoPlayer && <span className="text-xs text-muted-foreground ml-2" aria-hidden="true">({wordsCount} words)</span>}
                    {isWinner && <span className="ml-2 text-xs text-primary font-bold" aria-hidden="true">★ WINNER</span>}
                  </div>
                  <span className="text-xl font-black text-primary" aria-hidden="true">{p.score}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <Button
          className="w-full"
          size="lg"
          aria-label="Play again — reload and start a new game"
          onClick={() => {
            onClose();
            window.location.reload();
          }}
        >
          Play Again
        </Button>
      </div>
    </Modal>
  );
};

export const RulesModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="How to Play"
    icon={<AlertCircle className="w-6 h-6" />}
    description="Rules for playing Word Tiger"
  >
    <ul className="space-y-4 list-disc pl-5">
      <li>Find as many words as you can using the 9 letters provided.</li>
      <li>Words must be at least <strong>4 letters</strong> long.</li>
      <li>Words <strong>MUST</strong> include the center highlighted letter.</li>
      <li>You can only use a letter as many times as it appears in the grid.</li>
      <li>Each valid word earns <strong>1 point</strong>.</li>
      <li>
        In <strong>Versus</strong> mode, players alternate turns. Each turn has a{' '}
        <strong>30-second timer</strong> — run out and your turn passes to the other player.
      </li>
      <li>Words found are color-coded by player so you can track who found what.</li>
      <li>The player with the most words when the game ends <strong>wins</strong>!</li>
    </ul>
  </Modal>
);

export const ShortcutsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Keyboard Shortcuts"
    icon={<Keyboard className="w-6 h-6" />}
    description="All keyboard shortcuts for controlling the game without a mouse"
  >
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
      {[
        ['A–Z', 'Add letter to word (tap grid or type)'],
        ['⌫ / Backspace', 'Delete last letter'],
        ['Enter', 'Submit word'],
        ['Space', 'Hold to speak a word'],
        ['2', 'Read all letters aloud'],
        ['3', 'End game (press again to confirm)'],
        ['S', 'Read game status (when word is empty)'],
        ['H', 'Hint (when word is empty)'],
        ['R', 'Rules (when word is empty)'],
        ['K', 'This shortcuts panel (when word is empty)'],
        ['Esc', 'Close dialog / cancel end-game prompt'],
      ].map(([key, desc]) => (
        <React.Fragment key={key}>
          <dt>
            <kbd className="bg-secondary px-2 py-1 rounded text-xs font-mono border border-border text-foreground whitespace-nowrap">
              {key}
            </kbd>
          </dt>
          <dd className="flex items-center text-sm">{desc}</dd>
        </React.Fragment>
      ))}
    </dl>
  </Modal>
);
