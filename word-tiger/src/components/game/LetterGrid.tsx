import React from 'react';
import { motion } from 'framer-motion';
import type { Puzzle } from '@/lib/puzzle';
import { cn } from '@/lib/utils';

interface LetterGridProps {
  puzzle: Puzzle;
  onLetterClick: (letter: string) => void;
  flash?: { letters: Set<string>; type: 'success' | 'error'; id: number } | null;
}

export function LetterGrid({ puzzle, onLetterClick, flash }: LetterGridProps) {
  return (
    <div
      role="group"
      aria-label={`Letter grid. Your 9 letters are: ${puzzle.letters.join(', ').toUpperCase()}. Required center letter: ${puzzle.required.toUpperCase()}`}
      className="grid grid-cols-3 gap-3.5 md:gap-4 w-full max-w-[380px] mx-auto p-4 md:p-6 bg-secondary/30 rounded-3xl backdrop-blur-sm border border-white/5 box-glow"
    >
      {puzzle.letters.map((letter, i) => {
        const isCenter = i === puzzle.centerIndex;
        const isFlashed = flash?.letters.has(letter.toLowerCase()) ?? false;
        const flashClass = isFlashed
          ? (flash?.type === 'success' ? 'tile-flash-success' : 'tile-flash-error')
          : '';

        return (
          <motion.button
            key={isFlashed ? `${letter}-${i}-${flash!.id}` : `${letter}-${i}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onLetterClick(letter)}
            aria-label={isCenter
              ? `${letter.toUpperCase()}, required center letter — must appear in every word`
              : `Letter ${letter.toUpperCase()}`}
            className={cn(
              "flex items-center justify-center aspect-square rounded-2xl text-4xl md:text-4xl font-display font-bold uppercase select-none transition-colors border-2 shadow-lg",
              isCenter
                ? "bg-gradient-to-br from-primary to-orange-600 text-primary-foreground border-orange-400 shadow-orange-500/20"
                : "bg-card text-foreground border-border hover:border-primary/50",
              flashClass,
            )}
          >
            {letter}
            {isCenter && <span className="sr-only"> (required)</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
