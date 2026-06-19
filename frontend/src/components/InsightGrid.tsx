'use client';

import React, { useState, useCallback } from 'react';

export interface Challenge {
  title: string;
  description: string;
  potentialSavingKg: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category?: 'transport' | 'food' | 'energy' | 'waste' | 'other';
}

interface InsightGridProps {
  challenges: Challenge[];
}

/**
 * InsightGrid Component
 * Renders a grid of personalized sustainability challenges.
 * 
 * EFFICIENCY: Wrapped in React.memo and uses useCallback to prevent unnecessary re-renders.
 */
const InsightGrid = React.memo(({ challenges }: InsightGridProps) => {
  // Keep track of completed challenges locally to show interactive state
  const [completedChallenges, setCompletedChallenges] = useState<Record<string, boolean>>({});

  const toggleComplete = useCallback((title: string) => {
    setCompletedChallenges((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  }, []);

  if (challenges.length === 0) {
    return (
      <section 
        aria-labelledby="insights-heading"
        className="p-8 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 text-center"
      >
        <h2 id="insights-heading" className="text-xl font-semibold text-slate-300">
          Personalized Reduction Plan
        </h2>
        <p className="text-slate-500 mt-2 text-sm">
          No challenges available. Submit an activity above to identify emissions and generate micro-challenges.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="insights-heading" className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 
            id="insights-heading" 
            className="text-2xl font-bold text-slate-100 tracking-tight"
          >
            Personalized Mitigation Plan
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Complete these recommended micro-challenges targeting your highest emission vectors.
          </p>
        </div>
      </header>

      {/* Grid of Micro-Challenges */}
      <div 
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        role="region"
        aria-label="Sustainability challenges grid"
      >
        {challenges.map((challenge, index) => {
          const isCompleted = !!completedChallenges[challenge.title];
          const challengeId = `challenge-card-${index}`;
          const titleId = `challenge-title-${index}`;
          const descId = `challenge-desc-${index}`;

          // Choose color based on difficulty level
          const difficultyColors = {
            easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          };

          return (
            <article
              key={challenge.title}
              id={challengeId}
              aria-labelledby={titleId}
              aria-describedby={descId}
              className={`relative flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 ${
                isCompleted
                  ? 'bg-slate-950/80 border-emerald-500/30 opacity-60'
                  : 'bg-slate-900/60 hover:bg-slate-900/80 border-slate-800 shadow-lg'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <span 
                    className={`text-xs px-2.5 py-1 font-semibold rounded-full border uppercase tracking-wider ${
                      difficultyColors[challenge.difficulty] || difficultyColors.easy
                    }`}
                  >
                    {challenge.difficulty}
                  </span>
                  
                  <span 
                    className="text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1"
                    aria-label={`Saves ${challenge.potentialSavingKg} kilograms of carbon dioxide equivalent`}
                  >
                    -{challenge.potentialSavingKg} kg CO₂e
                  </span>
                </div>

                <h3 
                  id={titleId}
                  className={`text-lg font-bold tracking-tight ${
                    isCompleted ? 'text-slate-500 line-through' : 'text-slate-100'
                  }`}
                >
                  {challenge.title}
                </h3>

                <p 
                  id={descId}
                  className={`text-sm leading-relaxed ${
                    isCompleted ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {challenge.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-slate-500" aria-hidden="true">
                  {isCompleted ? 'Challenge Completed!' : 'Ready to start?'}
                </span>
                
                <button
                  onClick={() => toggleComplete(challenge.title)}
                  aria-pressed={isCompleted}
                  aria-label={`Mark "${challenge.title}" challenge as ${isCompleted ? 'incomplete' : 'complete'}`}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer transition-all ${
                    isCompleted
                      ? 'bg-slate-850 text-slate-400 border border-slate-700 hover:bg-slate-800'
                      : 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold'
                  }`}
                >
                  {isCompleted ? 'Undo Action' : 'Complete Challenge'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
});

InsightGrid.displayName = 'InsightGrid';

export default InsightGrid;
