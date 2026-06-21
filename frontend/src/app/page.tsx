"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import ActionTracker from "../components/ActionTracker";
import InsightGrid, { Challenge } from "../components/InsightGrid";

interface ActivityItem {
  category: string;
  value: number;
  unit: string;
  description: string;
  co2eKg: number;
}

interface TrackingData {
  activities: ActivityItem[];
  summary: {
    totalCo2eKg: number;
    dailyBaselineKg: number;
    differenceKg: number;
    percentageDifference: number;
    status: "under_baseline" | "over_baseline";
    hotspot: ActivityItem | null;
  };
  microChallenges: Challenge[];
  summaryInsight: string;
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<TrackingData | null>(null);
  const [history, setHistory] = useState<
    Array<{ text: string; date: string; co2eKg: number }>
  >([]);
  const [announcement, setAnnouncement] = useState("");

  // Default values before any submission
  const dailyTarget = 15.0;

  /**
   * Submits the natural language input to the orchestrator layer.
   * EFFICIENCY: Wrapped in useCallback to prevent unnecessary re-renders of the child ActionTracker.
   */
  const handleTrackActivity = useCallback(
    async (activityString: string) => {
      setIsLoading(true);
      setAnnouncement("Analyzing your activities for carbon emissions...");

      try {
        const response = await fetch("/api/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            activityString: activityString.trim(),
            profileContext: {
              dailyBaselineKg: dailyTarget,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "API request failed");
        }

        const result: { success: boolean; data: TrackingData } =
          await response.json();

        if (result.success && result.data) {
          setData(result.data);

          // Add to local session history
          setHistory((prev) => [
            {
              text: activityString,
              date: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              co2eKg: result.data.summary.totalCo2eKg,
            },
            ...prev,
          ]);

          const totalCO2 = result.data.summary.totalCo2eKg;
          const statusMsg =
            result.data.summary.status === "over_baseline"
              ? `exceeds your daily target by ${result.data.summary.differenceKg} kilograms.`
              : `keeps you under your daily target by ${Math.abs(result.data.summary.differenceKg)} kilograms.`;

          setAnnouncement(
            `Analysis complete. Your activity emitted ${totalCO2} kilograms of CO2, which ${statusMsg} Challenges generated.`,
          );
        } else {
          throw new Error("Malformed response from backend");
        }
      } catch (err) {
        setAnnouncement(
          "Error occurred during carbon analysis. Please try again.",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [dailyTarget],
  );

  // Compute values for stats cards
  const displayTotal = data ? data.summary.totalCo2eKg : 0.0;
  const deviation = data ? data.summary.differenceKg : 0.0;
  const isOver = data ? data.summary.status === "over_baseline" : false;
  const progressPercent = Math.min((displayTotal / dailyTarget) * 100, 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Invisible live region for screen readers */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 overflow-hidden p-[2px]">
              <Image
                src="/logo.png"
                alt="Eco-Pulse Logo"
                width={48}
                height={48}
                className="w-full h-full object-cover rounded-[10px]"
              />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Eco-Pulse
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-slate-400">
              Agent Layer Connected
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* UNDERSTAND Pillar: Carbon Metric Displays */}
        <section
          aria-labelledby="metrics-heading"
          className="p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <header className="mb-6">
            <h2
              id="metrics-heading"
              className="text-sm font-bold uppercase tracking-wider text-emerald-400"
            >
              Impact Overview
            </h2>
            <p className="text-3xl font-extrabold text-white mt-1 tracking-tight">
              Understand Your Footprint
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stat Card 1: Total Emission */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Current Footprint
              </span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-extrabold text-white">
                  {displayTotal}
                </span>
                <span className="text-sm text-slate-400 font-semibold">
                  kg CO₂e
                </span>
              </div>
              <div className="mt-4 w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={displayTotal}
                  aria-valuemin={0}
                  aria-valuemax={dailyTarget}
                  aria-label="Progress towards daily carbon target limit"
                />
              </div>
            </div>

            {/* Stat Card 2: Limit Target */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Daily Budget Limit
              </span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-extrabold text-white">
                  {dailyTarget}
                </span>
                <span className="text-sm text-slate-400 font-semibold">
                  kg CO₂e
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Target threshold aligned with regional environmental
                sustainability guidelines.
              </p>
            </div>

            {/* Stat Card 3: Deviation status */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/80">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Net Deviation
              </span>
              <div className="flex items-baseline gap-1 mt-2">
                <span
                  className={`text-4xl font-extrabold ${
                    isOver
                      ? "text-rose-400"
                      : displayTotal === 0
                        ? "text-slate-400"
                        : "text-emerald-400"
                  }`}
                >
                  {isOver
                    ? `+${deviation}`
                    : deviation === 0
                      ? "0.00"
                      : `${deviation}`}
                </span>
                <span className="text-sm text-slate-400 font-semibold">
                  kg CO₂e
                </span>
              </div>
              <span
                className={`inline-block mt-3.5 text-xs font-bold px-2.5 py-1 rounded-md ${
                  isOver
                    ? "bg-rose-500/10 text-rose-400"
                    : displayTotal === 0
                      ? "bg-slate-900 text-slate-400"
                      : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {isOver
                  ? "EXCEEDED BUDGET"
                  : displayTotal === 0
                    ? "NO DATA LOGGED"
                    : "WITHIN BUDGET TARGET"}
              </span>
            </div>
          </div>
        </section>

        {/* Action tracker input form and history container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* TRACK Pillar: natural language inputs */}
          <div className="lg:col-span-2 space-y-6">
            <ActionTracker
              onTrack={handleTrackActivity}
              isLoading={isLoading}
            />

            {/* REDUCE Pillar: list of micro challenges */}
            {data?.summaryInsight && (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-sm text-emerald-300 font-medium leading-relaxed">
                {data.summaryInsight}
              </div>
            )}
            <InsightGrid challenges={data?.microChallenges || []} />
          </div>

          {/* Session history section */}
          <aside aria-labelledby="history-heading" className="space-y-4">
            <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-850 shadow-md">
              <h3
                id="history-heading"
                className="text-lg font-bold text-slate-200"
              >
                Logged Actions
              </h3>

              <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-4 text-center">
                    No actions logged during this session.
                  </p>
                ) : (
                  history.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-900 flex flex-col justify-between gap-2"
                    >
                      <p className="text-sm text-slate-300 font-normal leading-relaxed">
                        {item.text}
                      </p>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-slate-500">{item.date}</span>
                        <span className="font-bold text-slate-400">
                          {item.co2eKg} kg CO₂e
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-900 mt-16 bg-slate-950 py-8 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4">
          <p>
            © {new Date().getFullYear()} Eco-Pulse Carbon Mitigation Dashboard.
          </p>
          <p className="mt-1">
            Built using Next.js & Tailwind CSS, following WCAG AA accessibility
            practices.
          </p>
        </div>
      </footer>
    </div>
  );
}
