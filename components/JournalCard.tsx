'use client';
import type { Journal, PublisherMetrics } from '@/lib/types';
import { ArrowUpRight, BookOpen, ExternalLink, Check, Copy, LoaderCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';

const fmt = (n: number | null, digits = 2) => n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits });
type Status = 'idle' | 'loading' | 'done' | 'error';
/** Indexing status from SCImago (Scopus) and the publisher-reported Impact Factor (Web of Science). */
export function indexStatus(journal: Journal, p: PublisherMetrics | undefined, status: Status): { label: string; tone: 'good' | 'none' | 'unknown' } {
  const m = journal.metrics;
  const scopus = !!(m.quartile || m.indexed === 'scopus' || m.citeScore != null || p?.citeScore != null || p?.scopusQuartile);
  if (!scopus && m.indexed === 'not-indexed' && p?.impactFactor == null) return { label: 'Not indexed in Scopus', tone: 'none' };
  const wos = p?.impactFactor != null;
  if (scopus && wos) return { label: 'Indexed: Scopus + Web of Science', tone: 'good' };
  if (scopus) return { label: 'Indexed: Scopus', tone: 'good' };
  if (wos) return { label: 'Indexed: Web of Science', tone: 'good' };
  if (status === 'loading') return { label: 'Checking indexing…', tone: 'unknown' };
  if (m.indexed === 'not-indexed' && status !== 'error') return { label: 'Not indexed in Scopus or Web of Science', tone: 'none' };
  if (status === 'done') return { label: 'No Scopus or Web of Science listing found', tone: 'none' };
  return { label: 'Indexing status unknown', tone: 'unknown' };
}
function QuartileBadge({ q }: { q: string | null }) {
  return q ? <span className={`quartile quartile-${q.toLowerCase()}`} title="Best Scopus (SJR) quartile">{q}</span> : <span className="quartile quartile-none" title="No quartile found">No quartile</span>;
}

export default function JournalCard({ journal, index, fieldMode = false, publisher: p, publisherStatus = 'idle' }: { journal: Journal; index: number; fieldMode?: boolean; publisher?: PublisherMetrics; publisherStatus?: Status }) {
  const [expanded, setExpanded] = useState(false); const [copied, setCopied] = useState(false);
  const m = journal.metrics;
  const quartile = m.quartile || m.citeScoreQuartile || p?.scopusQuartile || null;
  const quartileSource = m.quartile ? 'SJR (SCImago)' : m.citeScoreQuartile ? `CiteScore${m.citeScorePercentile != null ? `, ${m.citeScorePercentile}th percentile` : ''}` : quartile ? 'Scopus' : null;
  const citeScore = m.citeScore ?? p?.citeScore ?? null; const citeScoreYear = m.citeScore != null ? m.citeScoreYear : p?.citeScoreYear ?? null;
  const status = indexStatus(journal, p, publisherStatus);
  const pending = publisherStatus === 'loading' && !p;
  const spinner = <LoaderCircle className="spin" size={18} />;
  const headline: [string, React.ReactNode, string | null][] = [
    ['CiteScore', pending && citeScore == null ? spinner : fmt(citeScore, 1), citeScoreYear],
    ['Impact Factor', pending ? spinner : fmt(p?.impactFactor ?? null, 1), p?.impactFactorYear ? `JCR ${p.impactFactorYear}` : null],
    ['Quartile', pending && !quartile ? spinner : <>{quartile || '—'}{p?.jcrQuartile ? <small>JCR {p.jcrQuartile}</small> : null}</>, quartileSource],
  ];
  const copy = async () => { await navigator.clipboard.writeText([journal.name, journal.issn ? `ISSN ${journal.issn}` : '', `Status: ${status.label}`, `Impact Factor: ${fmt(p?.impactFactor ?? null, 1)}${p?.impactFactorYear ? ` (JCR ${p.impactFactorYear})` : ''} | CiteScore: ${fmt(citeScore, 1)} | Quartile: ${quartile || 'n/a'}`, `SJR: ${fmt(m.sjr, 3)} | Cites/doc (2y): ${fmt(m.citesPerDoc2y)} | OpenAlex 2y citedness: ${fmt(m.openAlexCitedness2y)}`, journal.homepage || journal.openalexUrl].filter(Boolean).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const stats: [string, string, string][] = [
    ['SJR', fmt(m.sjr, 3), 'SCImago Journal Rank'],
    ['Cites / doc (2y)', fmt(m.citesPerDoc2y), 'SCImago citations per document over 2 years, comparable to an impact factor'],
    ['2y citedness', fmt(m.openAlexCitedness2y), 'OpenAlex 2-year mean citedness, comparable to an impact factor'],
    ['H-index', fmt(m.scimagoHIndex ?? m.openAlexHIndex, 0), 'Journal H-index'],
    ['APC', m.apcUsd == null ? '—' : m.apcUsd === 0 ? 'None' : `$${m.apcUsd.toLocaleString('en-US')}`, 'Article processing charge listed in OpenAlex (open-access fee)'],
  ];
  return <article className="journal-card">
    <div className="journal-top">
      <span className="journal-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="journal-head">
        <div className="journal-overline"><BookOpen size={13} /> {journal.publisher || 'Journal'} {journal.issn ? `· ISSN ${journal.issn}` : ''}</div>
        <h3>{journal.name}</h3>
        <p>{journal.reason}</p>
        {journal.aiFit ? <p className="journal-ai-note"><Sparkles size={13} /> AI scope view ({journal.aiFit.score}/100): {journal.aiFit.reason}</p> : null}
      </div>
      <div className="journal-score"><QuartileBadge q={quartile} />{fieldMode ? <span>{journal.focusPercent}% field focus</span> : <><strong>{journal.score}<small>/100</small></strong><span>Scope fit*</span></>}</div>
    </div>
    <div className="headline-metrics">
      {headline.map(([label, value, sub]) => <div key={label}><strong>{value}</strong><span>{label}</span>{sub ? <small>{sub}</small> : null}</div>)}
      <div className={`index-status index-${status.tone}`}><span>STATUS</span><strong>{status.label}</strong></div>
    </div>
    {p?.sourceUrl ? <a className="metric-source" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">Impact Factor / CiteScore source: {new URL(p.sourceUrl).hostname} <ExternalLink size={11} /></a> : publisherStatus === 'done' && !p ? <p className="metric-source">Impact Factor lookup covers the top 20 results.</p> : null}
    <div className="metric-grid">{stats.map(([label, value, title]) => <div key={label} title={title}><span>{label}</span><strong>{value}</strong></div>)}</div>
    {journal.designEvidence ? <div className="journal-design"><ShieldAlert size={14} /><span>{journal.designEvidence}</span></div> : null}
    <div className="journal-meta">
      <span className="pill pill-green">{journal.fitLabel}</span>
      {fieldMode ? null : <span className="pill">{journal.focusPercent}% of output in your topic</span>}
      {m.inDoaj ? <span className="pill">Open access (DOAJ)</span> : journal.openAccess ? <span className="pill">Open access</span> : <span className="pill">Subscription / hybrid</span>}
      {m.categories.map(c => <span className="pill" key={c}>{c}</span>)}
    </div>
    {expanded ? <div className="journal-expand">
      {journal.scopeTopics.length ? <><div className="label-small">WHAT THIS JOURNAL PUBLISHES MOST</div><div className="tags">{journal.scopeTopics.map(t => <span key={t}>{t}</span>)}</div></> : null}
      {journal.works.length ? <><div className="label-small">EXAMPLE PUBLISHED WORKS</div>{journal.works.map((w, i) => <a className="work-link" href={w.url} key={`${w.title}${i}`} target="_blank" rel="noopener noreferrer"><span>{w.title} {w.year ? `(${w.year})` : ''}</span><ExternalLink size={13} /></a>)}</> : null}
      <div className="journal-warning"><ShieldAlert size={17} /><span>{journal.verification}</span></div>
    </div> : null}
    <div className="journal-actions">
      <button className="text-btn" onClick={() => setExpanded(x => !x)}>{expanded ? 'Hide details' : 'Scope & example papers'} <ArrowUpRight size={15} /></button>
      <button className="text-btn subdued" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy details'}</button>
      {journal.homepage ? <a className="text-btn subdued" href={journal.homepage} target="_blank" rel="noopener noreferrer">Journal site <ExternalLink size={14} /></a> : null}
      <a className="text-btn subdued" href={journal.openalexUrl} target="_blank" rel="noopener noreferrer">OpenAlex <ExternalLink size={14} /></a>
    </div>
  </article>;
}
