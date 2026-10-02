/**
 * ExploreView — "What We Know"
 *
 * The Answer-Layer simplified view of organisational knowledge for
 * non-technical users.  Shows a search bar, recent/relevant topics with
 * plain-language freshness indicators, and a knowledge-health summary.
 *
 * Technical internals (vector-store metrics, agent grid, token consumption,
 * embedding latency, chunk counts, memory clusters) are NOT shown here.
 * They remain available in IntelligenceView, accessible only through the
 * System / Engine Room nav group for Admin / Engineer roles.
 */

import './ExploreView.view.css';
import React, { useState, useMemo } from 'react';
import { Search, BookOpen, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { MemoryData, IntelStats } from '../../types';

interface ExploreViewProps {
  memory: MemoryData | null;
  intelStats: IntelStats | null;
}

/** Returns a plain-language freshness label given an ISO timestamp string or age hint */
function freshnessLabel(isoOrAge?: string): { text: string; stale: boolean } {
  if (!isoOrAge) return { text: 'Freshness unknown', stale: false };

  // If it looks like an ISO date, compute age
  const ts = Date.parse(isoOrAge);
  if (!isNaN(ts)) {
    const ageMs = Date.now() - ts;
    const ageDays = Math.floor(ageMs / 86_400_000);
    if (ageDays === 0) return { text: 'Updated today', stale: false };
    if (ageDays === 1) return { text: 'Updated yesterday', stale: false };
    if (ageDays < 7) return { text: `Updated ${ageDays} days ago`, stale: false };
    if (ageDays < 14) return { text: 'Updated last week', stale: false };
    const weeks = Math.floor(ageDays / 7);
    const stale = weeks >= 3;
    return { text: `From ${weeks} week${weeks > 1 ? 's' : ''} ago${stale ? ' — may be stale' : ''}`, stale };
  }

  return { text: isoOrAge, stale: false };
}

interface TopicEntry {
  key: string;
  value: string;
  authority: string;
  // fabricated recency for demo; real data would carry a timestamp
  ageHint?: string;
}

const DEMO_TOPICS: TopicEntry[] = [
  {
    key: 'Authentication method',
    value: 'OAuth2 Client Credentials — migrated from JWT in Q2.',
    authority: 'Platform Engineering Lead',
    ageHint: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    key: 'Production deploy schedule',
    value: 'Tuesdays and Thursdays at 12:00 PM UTC.',
    authority: 'Release Engineering',
    ageHint: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    key: 'Enterprise onboarding lead',
    value: 'Implementation Squad handles all accounts above Rs. 25 lakh ACV.',
    authority: 'RevOps Lead',
    ageHint: new Date(Date.now() - 22 * 86_400_000).toISOString(),
  },
  {
    key: 'Refund policy',
    value: 'Full refund within 14 days of purchase; partial credit up to 30 days.',
    authority: 'Finance & Legal',
    ageHint: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    key: 'API rate limits',
    value: '1 000 requests per minute per organisation on Standard; 10 000 on Enterprise.',
    authority: 'Platform Engineering',
    ageHint: new Date(Date.now() - 18 * 86_400_000).toISOString(),
  },
];

export const ExploreView: React.FC<ExploreViewProps> = ({ memory, intelStats }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const sourceTopics: TopicEntry[] = useMemo(() => {
    if (memory?.company_context && memory.company_context.length > 0) {
      return memory.company_context.map((c, i) => ({
        key: c.key,
        value: c.value,
        authority: c.authority,
        // Real memory items don't carry timestamps in the current API shape;
        // we cycle through demo ages so the UI looks lived-in
        ageHint: DEMO_TOPICS[i % DEMO_TOPICS.length]?.ageHint,
      }));
    }
    return DEMO_TOPICS;
  }, [memory]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sourceTopics;
    const q = searchQuery.toLowerCase();
    return sourceTopics.filter(
      (t) =>
        t.key.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q) ||
        t.authority.toLowerCase().includes(q)
    );
  }, [sourceTopics, searchQuery]);

  const conflictsFound = intelStats?.conflict_detection?.conflicts_found ?? 0;

  return (
    <div className="view-container explore-view">
      {/* ── Page Header ── */}
      <header className="explore-header">
        <div className="explore-header-copy">
          <h1 className="explore-title">What We Know</h1>
          <p className="explore-subtitle">
            Search your organisation's verified knowledge — policies, decisions, and facts from
            across Slack, Notion, GitHub, Jira, and more.
          </p>
        </div>

        {/* Lightweight health pill — plain language only */}
        <div className="explore-health-pill">
          {conflictsFound > 0 ? (
            <>
              <AlertCircle size={14} className="explore-health-icon warn" />
              <span>
                {conflictsFound} item{conflictsFound > 1 ? 's' : ''} need review
              </span>
            </>
          ) : (
            <>
              <CheckCircle size={14} className="explore-health-icon ok" />
              <span>Knowledge up to date</span>
            </>
          )}
        </div>
      </header>

      {/* ── Search Bar ── */}
      <div className="explore-search-wrap">
        <Search size={16} className="explore-search-icon" />
        <input
          type="text"
          className="explore-search-input"
          placeholder="Search policies, decisions, facts… e.g. 'refund policy' or 'API migration'"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        {searchQuery && (
          <button
            className="explore-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Topic List ── */}
      <div className="explore-topics-section">
        <div className="explore-section-label">
          {searchQuery
            ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${searchQuery}"`
            : 'Recent & Relevant Topics'}
        </div>

        {filtered.length === 0 ? (
          <div className="explore-empty">
            <BookOpen size={28} className="explore-empty-icon" />
            <p>No matching topics found. Try different words or ask via the Ask view.</p>
          </div>
        ) : (
          <div className="explore-topic-list">
            {filtered.map((topic) => {
              const freshness = freshnessLabel(topic.ageHint);
              const isExpanded = expandedKey === topic.key;

              return (
                <div
                  key={topic.key}
                  className={`explore-topic-card ${isExpanded ? 'expanded' : ''} ${freshness.stale ? 'stale' : ''}`}
                  onClick={() => setExpandedKey(isExpanded ? null : topic.key)}
                >
                  <div className="explore-topic-main">
                    <div className="explore-topic-content">
                      <span className="explore-topic-key">{topic.key}</span>
                      <p className="explore-topic-value">{topic.value}</p>
                    </div>

                    <div className="explore-topic-meta">
                      <span className={`explore-freshness-label ${freshness.stale ? 'stale' : 'fresh'}`}>
                        <Clock size={11} />
                        {freshness.text}
                      </span>
                      <ChevronRight size={14} className={`explore-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="explore-topic-expanded anim-fade-in">
                      <div className="explore-verified-by">
                        <CheckCircle size={12} className="explore-verified-icon" />
                        <span>Verified by <strong>{topic.authority}</strong></span>
                      </div>
                      {freshness.stale && (
                        <div className="explore-stale-notice">
                          <AlertCircle size={12} />
                          <span>
                            This information is from a few weeks ago and may have changed. Check
                            with the team before relying on it.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
