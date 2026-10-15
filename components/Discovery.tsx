'use client';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, BookMarked, CalendarClock, Layers, LoaderCircle, Presentation, Search, Sparkles, Users } from 'lucide-react';
import JournalCard from './JournalCard';
import EventCard from './EventCard';
import type { FitContext } from './FitReport';
import SUBFIELDS from '@/lib/data/subfields.json';
import type { DeadlineStatus, EventsResponse, JournalResponse, PublisherMetrics } from '@/lib/types';

export type Keywords = { phrases: string[]; keywords: string[]; researchArea: string; csCategories: string[]; cfpTags: string[]; mode: 'ai' | 'rules'; aiError?: string };
export type ManuscriptContext = { title: string; summary: string; keywords: string[]; text: string; studyType: string };
type Request = { mode: 'field'; fieldId: string; fieldName: string } | { mode: 'topic'; topic: string; abstract: string } | { mode: 'manuscript'; manuscript: ManuscriptContext };
type Section = 'journals' | 'conferences' | 'workshops';

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request to ${url} failed.`);
  return data as T;
}

/** Runs the whole search: AI keywords first, then journals and events in parallel. */
export function useDiscovery() {
  const [keywords, setKeywords] = useState<Keywords | null>(null);
  const [journals, setJournals] = useState<JournalResponse | null>(null);
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [stage, setStage] = useState<'idle' | 'keywords' | 'searching' | 'done'>('idle');
  const [errors, setErrors] = useState<{ keywords?: string; journals?: string; events?: string }>({});
  const [publisher, setPublisher] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; metrics: Record<string, PublisherMetrics>; error?: string }>({ status: 'idle', metrics: {} });
  /** Impact Factor and CiteScore load after the list, so journals appear without waiting for the web search. */
  function loadPublisherMetrics(res: JournalResponse) {
    const top = res.journals.slice(0, 20); if (!top.length) return;
    setPublisher({ status: 'loading', metrics: {} });
    post<{ metrics: Record<string, PublisherMetrics> }>('/api/journal-metrics', { journals: top.map(j => ({ id: j.id, name: j.name, issn: j.issn, publisher: j.publisher, homepage: j.homepage })) })
      .then(r => setPublisher({ status: 'done', metrics: r.metrics }))
      .catch(e => setPublisher({ status: 'error', metrics: {}, error: e instanceof Error ? e.message : 'Lookup failed.' }));
  }
  async function run(req: Request) {
    setKeywords(null); setJournals(null); setEvents(null); setErrors({}); setPublisher({ status: 'idle', metrics: {} }); setStage('keywords');
    let kw: Keywords;
    try {
      kw = await post<Keywords>('/api/keywords', req.mode === 'field' ? { mode: 'field', field: req.fieldName } : req.mode === 'topic' ? { mode: 'topic', topic: req.topic, abstract: req.abstract } : { mode: 'manuscript', title: req.manuscript.title, text: req.manuscript.text });
    } catch (e) { setErrors({ keywords: e instanceof Error ? e.message : 'Keyword step failed.' }); setStage('done'); return; }
    setKeywords(kw); setStage('searching');
    const journalBody = req.mode === 'field' ? { mode: 'field', fieldId: req.fieldId, fieldName: req.fieldName }
      : req.mode === 'topic' ? { query: req.topic, title: req.topic, summary: req.abstract || undefined, phrases: kw.mode === 'ai' ? kw.phrases : undefined, researchArea: kw.researchArea || undefined, keywords: kw.keywords }
      : { query: req.manuscript.title, title: req.manuscript.title, summary: req.manuscript.summary, phrases: kw.mode === 'ai' ? kw.phrases : undefined, researchArea: kw.researchArea || undefined, keywords: kw.keywords, studyType: req.manuscript.studyType };
    await Promise.all([
      post<JournalResponse>('/api/journals', journalBody).then(r => { setJournals(r); loadPublisherMetrics(r); }).catch(e => setErrors(x => ({ ...x, journals: e instanceof Error ? e.message : 'Journal search failed.' }))),
      post<EventsResponse>('/api/events', { phrases: kw.phrases, keywords: kw.keywords, researchArea: kw.researchArea, csCategories: kw.csCategories, cfpTags: kw.cfpTags }).then(setEvents).catch(e => setErrors(x => ({ ...x, events: e instanceof Error ? e.message : 'Conference search failed.' }))),
    ]);
    setStage('done');
  }
  return { keywords, journals, events, stage, errors, publisher, run };
}

export function FieldSearch({ onSearch, busy }: { onSearch: (id: string, name: string) => void; busy: boolean }) {
  const [value, setValue] = useState(''); const [error, setError] = useState('');
  const options = useMemo(() => SUBFIELDS.map(s => ({ ...s, label: `${s.name} — ${s.field}` })), []);
  const go = () => { const match = options.find(o => o.label.toLowerCase() === value.trim().toLowerCase()) || options.find(o => o.name.toLowerCase() === value.trim().toLowerCase()); if (!match) { setError('Pick a field from the suggestions list.'); return; } setError(''); onSearch(match.id, match.name); };
  return <div className="search-form">
    <label htmlFor="field-input">RESEARCH FIELD</label>
    <form className="explorer-input" onSubmit={e => { e.preventDefault(); go(); }}>
      <Layers size={19} /><input id="field-input" list="field-options" value={value} onChange={e => setValue(e.target.value)} placeholder="Start typing, e.g. Computer Vision and Pattern Recognition" autoComplete="off" />
      <datalist id="field-options">{options.map(o => <option key={o.id} value={o.label} />)}</datalist>
      <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} List journals</button>
    </form>
    <p className="form-hint">Lists journals dedicated to the field, ordered Q1 → Q4 → not indexed, plus conferences and workshops in the area. {SUBFIELDS.length} fields available.</p>
    {error ? <div className="alert alert-danger"><AlertCircle size={16} />{error}</div> : null}
  </div>;
}

export function TopicSearch({ onSearch, busy }: { onSearch: (topic: string, abstract: string) => void; busy: boolean }) {
  const [topic, setTopic] = useState(''); const [abstract, setAbstract] = useState(''); const [error, setError] = useState('');
  return <form className="search-form" onSubmit={e => { e.preventDefault(); if (topic.trim().length < 5) { setError('Enter your research topic or working title (at least a few words).'); return; } setError(''); onSearch(topic.trim(), abstract.trim()); }}>
    <label htmlFor="topic-input">TOPIC OR WORKING TITLE</label>
    <input id="topic-input" className="text-field" value={topic} onChange={e => setTopic(e.target.value)} maxLength={300} placeholder="e.g. Siamese network with attention for robust visual object tracking" />
    <label htmlFor="abstract-input">ABSTRACT <span>(optional, gives much better matches)</span></label>
    <textarea id="abstract-input" className="paste-field" rows={7} value={abstract} onChange={e => setAbstract(e.target.value)} maxLength={6000} placeholder="Paste your abstract here…" />
    {error ? <div className="alert alert-danger"><AlertCircle size={16} />{error}</div> : null}
    <button type="submit" className="btn btn-dark btn-large" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />} Find journals, conferences &amp; workshops <ArrowRight size={17} /></button>
  </form>;
}

/** Drops repeats (ignoring case) and anything already in `exclude`; AI keyword lists can repeat terms. */
function uniqueTerms(terms: string[], exclude: string[] = []): string[] {
  const seen = new Set(exclude.map(t => t.trim().toLowerCase()));
  return terms.filter(t => { const key = t.trim().toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}

const STATUS_FILTERS: { id: 'all' | DeadlineStatus; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'upcoming', label: 'Open deadlines' }, { id: 'tba', label: 'Deadline not announced' }, { id: 'passed', label: 'Passed' }];
const QUARTILE_FILTERS = ['All', 'Q1', 'Q2', 'Q3', 'Q4', 'Not indexed'];

export function DiscoveryResults({ discovery, fieldMode = false, fitContext }: { discovery: ReturnType<typeof useDiscovery>; fieldMode?: boolean; fitContext?: FitContext }) {
  const { keywords, journals, events, stage, errors, publisher } = discovery;
  const [section, setSection] = useState<Section>('journals');
  const [quartile, setQuartile] = useState('All');
  const [status, setStatus] = useState<'all' | DeadlineStatus>('all');
  if (stage === 'idle') return null;
  const quartileOf = (j: JournalResponse['journals'][number]) => j.metrics.quartile || j.metrics.citeScoreQuartile || publisher.metrics[j.id]?.scopusQuartile || null;
  const shownJournals = (journals?.journals || []).filter(j => quartile === 'All' || (quartile === 'Not indexed' ? !quartileOf(j) && j.metrics.indexed !== 'scopus' && publisher.metrics[j.id]?.impactFactor == null && (j.metrics.indexed === 'not-indexed' || publisher.status === 'done') : quartileOf(j) === quartile));
  const list = section === 'conferences' ? events?.conferences || [] : events?.workshops || [];
  const shownEvents = list.filter(e => status === 'all' || e.status === status);
  const count = (s: Section) => s === 'journals' ? journals?.journals.length : s === 'conferences' ? events?.conferences.length : events?.workshops.length;
  return <div className="discovery-results">
    {stage === 'keywords' ? <div className="loading-state"><LoaderCircle className="spin" size={32} /><strong>Reading your research</strong><p>Working out the right search keywords…</p></div> : null}
    {errors.keywords ? <div className="alert alert-danger"><AlertCircle size={17} />{errors.keywords}</div> : null}
    {keywords ? <div className="keyword-panel">
      <div><span className="eyebrow">{keywords.mode === 'ai' ? <><Sparkles size={12} /> SEARCH KEYWORDS BY GEMINI</> : 'SEARCH KEYWORDS'}</span>{keywords.researchArea ? <strong>{keywords.researchArea}</strong> : null}</div>
      <div className="tags">{uniqueTerms(keywords.phrases).map(p => <span key={`p-${p}`} className="tag-strong">{p}</span>)}{uniqueTerms(keywords.keywords, keywords.phrases).slice(0, 8).map(k => <span key={`k-${k}`}>{k}</span>)}</div>
      {keywords.aiError ? <p className="muted-note">AI keywords unavailable ({keywords.aiError}); used keywords from your text instead.</p> : null}
    </div> : null}
    {keywords ? <>
      <div className="report-nav section-tabs" role="tablist">
        {([['journals', 'Journals', BookMarked], ['conferences', 'Conferences', Presentation], ['workshops', 'Workshops', Users]] as const).map(([id, label, Icon]) =>
          <button key={id} role="tab" aria-selected={section === id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon size={16} /> {label} <span className="count-badge">{count(id) ?? (stage === 'searching' ? '…' : 0)}</span></button>)}
      </div>
      {section === 'journals' ? <div>
        {errors.journals ? <div className="alert alert-danger"><AlertCircle size={17} />{errors.journals}</div> : null}
        {!journals && stage === 'searching' ? <div className="loading-state"><LoaderCircle className="spin" size={30} /><strong>Ranking journals</strong><p>{fieldMode ? 'Collecting journals dedicated to this field and their quartiles…' : 'Detecting your research topics, ranking journals by scope focus and adding quartiles and citation metrics…'}</p></div> : null}
        {journals ? <>
          <div className="results-header"><div><h2>{journals.journals.length} journals</h2><p>{fieldMode ? journals.notice : <>{journals.domain ? <>Domain: {journals.domain} · </> : null}Topic area: {journals.topics.join(' · ') || 'not detected'}{journals.mode === 'ai' ? ' · AI-refined ranking' : ''}</>}</p></div></div>
          {journals.broadenedTo ? <div className="alert alert-info"><Layers size={16} /> Few papers match your exact topic yet, so these results use the broader domain: <strong>{journals.broadenedTo}</strong>.</div> : null}
          {journals.aiError ? <div className="alert alert-warning"><AlertCircle size={17} /> AI ranking was unavailable ({journals.aiError}). Showing literature-based ranking.</div> : null}
          {publisher.status === 'loading' ? <div className="alert alert-info"><LoaderCircle className="spin" size={16} /> Looking up Impact Factor and CiteScore on publisher pages for the top {Math.min(20, journals.journals.length)} journals…</div> : publisher.status === 'error' ? <div className="alert alert-warning"><AlertCircle size={17} /> Impact Factor lookup unavailable ({publisher.error})</div> : null}
          <div className="filter-row">{QUARTILE_FILTERS.map(q => <button key={q} className={quartile === q ? 'selected' : ''} onClick={() => setQuartile(q)}>{q}</button>)}</div>
          {shownJournals.length ? <div className="journal-list">{shownJournals.map((j, i) => <JournalCard key={j.id} journal={j} index={i} fieldMode={fieldMode} publisher={publisher.metrics[j.id]} publisherStatus={publisher.status} fitContext={fitContext && { ...fitContext, phrases: fitContext.phrases || keywords?.phrases, keywords: fitContext.keywords || keywords?.keywords }} />)}</div> : <div className="empty-state"><BookMarked size={24} /><strong>No journals in this view</strong><p>{quartile !== 'All' ? 'Try another quartile filter.' : 'Try a broader or more specific topic.'}</p></div>}
          <div className="research-disclaimer"><AlertCircle size={17} /><p><strong>About these numbers.</strong> {journals.metricsNote} {fieldMode ? '' : journals.notice}</p></div>
        </> : null}
      </div> : <div>
        {errors.events ? <div className="alert alert-danger"><AlertCircle size={17} />{errors.events}</div> : null}
        {!events && stage === 'searching' ? <div className="loading-state"><LoaderCircle className="spin" size={30} /><strong>Collecting calls for papers</strong><p>Checking curated deadlines, WikiCFP and the web. This can take up to a minute…</p></div> : null}
        {events ? <>
          <div className="results-header"><div><h2>{list.length} {section}</h2><p>Sorted by open deadlines first, then rank.</p></div><CalendarClock size={26} color="var(--sage)" /></div>
          {events.aiError ? <div className="alert alert-warning"><AlertCircle size={17} /> AI web search was unavailable ({events.aiError}). Showing curated and WikiCFP results only.</div> : null}
          <div className="filter-row">{STATUS_FILTERS.map(f => <button key={f.id} className={status === f.id ? 'selected' : ''} onClick={() => setStatus(f.id)}>{f.label} ({f.id === 'all' ? list.length : list.filter(e => e.status === f.id).length})</button>)}</div>
          {shownEvents.length ? <div className="journal-list">{shownEvents.map(e => <EventCard key={e.id} event={e} />)}</div> : <div className="empty-state"><CalendarClock size={24} /><strong>No {section} in this view</strong><p>{section === 'workshops' ? 'Workshops are announced late and are harder to find; check the main conferences in your area for co-located workshops.' : 'Try another filter or a broader topic.'}</p></div>}
          {events.webSources.length ? <details className="web-sources"><summary>Web pages used by AI search ({events.webSources.length})</summary>{events.webSources.map((s, i) => <a key={`${i}-${s.url}`} href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>)}</details> : null}
          <div className="research-disclaimer"><AlertCircle size={17} /><p>{events.notice}</p></div>
        </> : null}
      </div>}
    </> : null}
  </div>;
}
