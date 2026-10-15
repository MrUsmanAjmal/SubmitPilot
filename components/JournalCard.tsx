'use client';
import type { Journal } from '@/lib/types';
import { ArrowUpRight, BookOpen, ExternalLink, Check, Copy, ShieldAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';

const fmt = (n: number | null, digits = 2) => n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits });
function QuartileBadge({ journal }: { journal: Journal }) {
  const m = journal.metrics;
  if (m.quartile) return <span className={`quartile quartile-${m.quartile.toLowerCase()}`} title="SCImago best quartile">{m.quartile}</span>;
  if (m.indexed === 'not-indexed') return <span className="quartile quartile-none" title="Not found in the SCImago (Scopus) list">Not indexed</span>;
  if (m.indexed === 'scopus') return <span className="quartile quartile-none" title="Indexed in Scopus; quartile unavailable">Scopus</span>;
  return <span className="quartile quartile-none" title="Quartile data not loaded on this server">Q n/a</span>;
}

export default function JournalCard({ journal, index, fieldMode = false }: { journal: Journal; index: number; fieldMode?: boolean }) {
  const [expanded, setExpanded] = useState(false); const [copied, setCopied] = useState(false);
  const m = journal.metrics;
  const copy = async () => { await navigator.clipboard.writeText([journal.name, journal.issn ? `ISSN ${journal.issn}` : '', `Quartile: ${m.quartile || (m.indexed === 'not-indexed' ? 'Not indexed in Scopus' : 'n/a')}`, `SJR: ${fmt(m.sjr, 3)} | Cites/doc (2y): ${fmt(m.citesPerDoc2y)} | CiteScore: ${fmt(m.citeScore, 1)} | OpenAlex 2y citedness: ${fmt(m.openAlexCitedness2y)}`, journal.homepage || journal.openalexUrl].filter(Boolean).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const stats: [string, string, string][] = [
    ['SJR', fmt(m.sjr, 3), 'SCImago Journal Rank'],
    ['Cites / doc (2y)', fmt(m.citesPerDoc2y), 'SCImago citations per document over 2 years, comparable to an impact factor'],
    ['CiteScore', m.citeScore == null ? '—' : `${fmt(m.citeScore, 1)}${m.citeScoreYear ? ` (${m.citeScoreYear})` : ''}`, 'Scopus CiteScore'],
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
      <div className="journal-score"><QuartileBadge journal={journal} />{fieldMode ? <span>{journal.focusPercent}% field focus</span> : <><strong>{journal.score}<small>/100</small></strong><span>Scope fit*</span></>}</div>
    </div>
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
