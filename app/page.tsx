"use client";

import { useState } from "react";

type JobMatch = {
  platform: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  url: string;
  postedDate?: string;
  scores: {
    overall: number;
    skillMatch: number;
    titleMatch: number;
    topApplicant: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
};

type ApiResponse = {
  success: boolean;
  data?: {
    resumeData: {
      name?: string;
      email?: string;
      skills: string[];
      jobTitles: string[];
      experienceCount: number;
    };
    jobsSearched: number;
    topMatches: JobMatch[];
  };
  progress: string[];
  error?: string;
  message?: string;
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [progress, setProgress] = useState<string[]>([]);
  const [resumeData, setResumeData] = useState<{
    name?: string;
    email?: string;
    skills: string[];
    jobTitles: string[];
    experienceCount: number;
  } | null>(null);

  const runMatch = async () => {
    try {
      setLoading(true);
      setError(null);
      setMatches([]);
      setProgress([]);
      setResumeData(null);

      // Connect to SSE stream for real-time progress
      const response = await fetch("/api/run-match-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to start job matching");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream available");
      }

      // Read SSE stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            if (data.progress) {
              // Real-time progress update
              setProgress(prev => [...prev, data.progress]);
            } else if (data.error) {
              // Error occurred
              setError(data.error);
              setLoading(false);
              return;
            } else if (data.complete && data.data) {
              // Final results
              setMatches(data.data.topMatches);
              setResumeData(data.data.resumeData);
              setLoading(false);
            }
          }
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {/* Header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">AI-Powered Job Matcher</h1>
          <p className="mt-2 text-sm text-slate-500">
            Automatically extracts data from your resume, searches for jobs using Ollama AI, and ranks them by match quality.
          </p>
          <div className="mt-6">
            <button
              onClick={runMatch}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {loading ? "Running..." : "Run Match"}
            </button>
          </div>
        </section>

        {/* Progress Section */}
        {loading && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <h2 className="text-lg font-medium text-blue-900">Processing...</h2>
            <div className="mt-4 space-y-2">
              {progress.length > 0 ? (
                progress.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="mt-0.5">
                      {step.startsWith('✅') ? '✅' :
                       step.startsWith('❌') ? '❌' :
                       step.startsWith('⚠️') ? '⚠️' :
                       step.startsWith('🚀') ? '🚀' :
                       step.startsWith('📄') ? '📄' :
                       step.startsWith('🔍') ? '🔍' :
                       step.startsWith('💾') ? '💾' :
                       step.startsWith('🤖') ? '🤖' :
                       step.startsWith('📊') ? '📊' :
                       step.startsWith('🎯') ? '🎯' :
                       step.startsWith('✨') ? '✨' :
                       '⏳'}
                    </span>
                    <span>{step.replace(/^[^\s]+\s/, '')}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span>Initializing...</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Error Section */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error:</strong> {error}
            {progress.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs">View progress log</summary>
                <pre className="mt-2 text-xs">{progress.join('\n')}</pre>
              </details>
            )}
          </div>
        )}

        {/* Resume Data Summary */}
        {resumeData && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-slate-900">Resume Summary</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Name</div>
                <div className="text-sm font-medium text-slate-900">{resumeData.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Email</div>
                <div className="text-sm font-medium text-slate-900">{resumeData.email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Skills Found</div>
                <div className="text-sm font-medium text-slate-900">{resumeData.skills.length}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Experience</div>
                <div className="text-sm font-medium text-slate-900">{resumeData.experienceCount} positions</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Job Titles</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {resumeData.jobTitles.map((title, idx) => (
                  <span key={idx} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {title}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Matches Section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Top Matches</h2>
          <div className="mt-4">
            {matches.length === 0 ? (
              <p className="text-sm text-slate-500">
                {loading
                  ? "Searching for matches..."
                  : resumeData
                  ? "No qualifying matches found."
                  : "Click 'Run Match' to start searching."}
              </p>
            ) : (
              <ul className="space-y-4">
                {matches.map((match, idx) => (
                  <li
                    key={`${match.platform}-${idx}`}
                    className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {match.title}
                          </h3>
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                            {match.scores.topApplicant}% top applicant
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {match.company} · {match.location}
                        </p>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">
                          {match.platform}
                          {match.postedDate
                            ? ` · ${new Date(match.postedDate).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <a
                        href={match.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-blue-200 px-3 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Apply
                      </a>
                    </div>

                    {/* Salary */}
                    {match.salary && (
                      <div className="mt-2 text-sm text-slate-500">{match.salary}</div>
                    )}

                    {/* Scores */}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Overall: </span>
                        <span className="font-medium text-slate-900">{match.scores.overall}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Skills: </span>
                        <span className="font-medium text-slate-900">{match.scores.skillMatch}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Title: </span>
                        <span className="font-medium text-slate-900">{match.scores.titleMatch}%</span>
                      </div>
                    </div>

                    {/* Match Reason */}
                    <p className="mt-3 text-sm text-slate-600">{match.reason}</p>

                    {/* Skills */}
                    <div className="mt-3">
                      {match.matchedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-slate-400">Matched:</span>
                          {match.matchedSkills.slice(0, 5).map((skill, i) => (
                            <span key={i} className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                      {match.missingSkills.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-xs text-slate-400">Missing:</span>
                          {match.missingSkills.slice(0, 5).map((skill, i) => (
                            <span key={i} className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
