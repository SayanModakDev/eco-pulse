'use client';

import React, { useState } from 'react';

interface ActionTrackerProps {
  onTrack: (activityString: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * ActionTracker Component
 * Provides an accessible textarea for users to describe their daily actions.
 * 
 * EFFICIENCY: Wrapped in React.memo to prevent unnecessary re-renders when the parent dashboard updates.
 */
const ActionTracker = React.memo(({ onTrack, isLoading }: ActionTrackerProps) => {
  const [activityString, setActivityString] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = activityString.trim();
    if (!trimmed) {
      setError('Please enter a description of your activities first.');
      return;
    }

    if (trimmed.length > 2000) {
      setError('Activity description is too long (maximum 2000 characters).');
      return;
    }

    try {
      await onTrack(trimmed);
      setActivityString(''); // Reset on successful tracking
    } catch (err) {
      setError('Failed to submit. Please check your connection and try again.');
    }
  };

  return (
    <section 
      aria-labelledby="tracker-heading"
      className="p-6 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl"
    >
      <header className="mb-4">
        <h2 
          id="tracker-heading" 
          className="text-xl font-semibold text-emerald-400"
        >
          Track Your Environmental Actions
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Describe your daily actions in natural language (e.g., "I drove 15km in my car and ate a beef burger").
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="activity-input" 
            className="sr-only"
          >
            Daily activity description
          </label>
          <textarea
            id="activity-input"
            rows={3}
            value={activityString}
            onChange={(e) => {
              setActivityString(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Type your daily activities here..."
            disabled={isLoading}
            aria-invalid={!!error}
            aria-describedby={error ? 'input-error' : 'input-hint'}
            className="w-full p-4 bg-slate-950 text-slate-100 rounded-xl border border-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none text-base font-normal leading-relaxed"
          />
          <div id="input-hint" className="sr-only">
            Describe your transportation, food, waste, or energy use today. Max 2000 characters.
          </div>
        </div>

        {/* Accessibility Error Alert Area */}
        <div aria-live="assertive" className="min-h-[24px]">
          {error && (
            <p 
              id="input-error" 
              className="text-sm text-red-400 flex items-center gap-1.5"
            >
              <svg 
                aria-hidden="true" 
                className="w-4 h-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span 
            className={`text-xs ${activityString.length > 1800 ? 'text-amber-400' : 'text-slate-500'}`}
            aria-hidden="true"
          >
            {activityString.length} / 2000
          </span>
          <button
            type="submit"
            disabled={isLoading || !activityString.trim()}
            aria-label={isLoading ? 'Submitting activities...' : 'Submit tracked activities'}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-emerald-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg 
                  className="animate-spin h-4 w-4 text-slate-950" 
                  fill="none" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              'Submit Action'
            )}
          </button>
        </div>
      </form>
    </section>
  );
});

ActionTracker.displayName = 'ActionTracker';

export default ActionTracker;
