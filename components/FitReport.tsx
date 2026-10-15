'use client';
import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, CircleHelp, ExternalLink, FileSearch, LoaderCircle, MinusCircle, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import type { CheckStatus, FitReport as Report, Journal } from '@/lib/types';

/** What the fit check compares the journal against: a full manuscript, or a topic with its abstract. */
export type FitContext = { mode: 'manuscript' | 'abstract'; title: string; text: string; phrases?: string[]; keywords?: string[] };

const STATUS: Record<CheckStatus, { label: string; Icon: typeof CheckCircle2; tone: string }> = {
  present: { label: 'OK', Icon: CheckCircle2, tone: 'ok' },
  partial: { label: 'Needs work', Icon: MinusCircle, tone: 'warn' },
  exceeds: { label: 'Over limit', Icon: XCircle, tone: 'bad' },
  missing: { label: 'Missing', Icon: XCircle, tone: 'bad' },
  unclear: { label: 'Check', Icon: CircleHelp, tone: 'info' },
};
const RISK_TEXT = { low: 'Low desk-rejection risk', medium: 'Medium desk-rejection risk', high: 'High desk-rejection risk' };

function Checklist({ items }: { items: Report['measured'] }) {
  return <div className="fit-checklist">{items.map((c, i) => { const s = STATUS[c.status]; return <div className={`fit-row fit-${s.tone}`} key={`${c.item}-${i}`}><s.Icon size={16} /><div><strong>{c.item} <span>{s.label}</span></strong><p>{c.detail}</p>{c.fix ? <p className="fit-fix">→ {c.fix}</p> : null}</div></div>; })}</div>;
}

export function FitReportView({ report }: { report: Report }) {
  const g = report.guidelines;
  const type = g?.articleTypes.find(t => /research|original|regular|full/i.test(t.name)) || g?.articleTypes[0];
  return <div className="fit-report">
    <div className={`fit-verdict risk-${report.deskRejectionRisk}`}>
      <ShieldAlert size={20} />
      <div><strong>{RISK_TEXT[report.deskRejectionRisk]}</strong><p>{report.readinessSummary}</p></div>
    </div>
    <div className="fit-grid">
      <div className={`fit-pill scope-${report.scopeFit.level}`}><span>SCOPE FIT</span><strong>{report.scopeFit.level}</strong><p>{report.scopeFit.reason}</p></div>
      <div className={`fit-pill novelty-${report.novelty.level}`}><span>NOVELTY</span><strong>{report.novelty.level === 'clear' ? 'Clear' : report.novelty.level === 'weak' ? 'Weak' : 'Unclear'}</strong><p>{report.novelty.reason}</p></div>
    </div>
    {report.rejectionRisks.length ? <section><h4><AlertTriangle size={15} /> Possible reasons for rejection</h4>
      {report.rejectionRisks.map((r, i) => <div className={`fit-risk sev-${r.severity}`} key={i}><div className="fit-risk-head"><strong>{r.reason}</strong><span>{r.severity}</span></div>{r.evidence ? <p>{r.evidence}</p> : null}{r.fix ? <p className="fit-fix">→ {r.fix}</p> : null}</div>)}
    </section> : null}
    {report.measured.length ? <section><h4><FileSearch size={15} /> Journal requirements check</h4><Checklist items={report.measured} /></section> : null}
    {report.structure.length ? <section><h4><FileSearch size={15} /> Structure and content{report.mode === 'abstract' ? ' (from the abstract only)' : ''}</h4><Checklist items={report.structure} /></section> : null}
    {report.novelty.overlaps.length ? <section><h4>Closest published work</h4>{report.novelty.overlaps.map((o, i) => <div className="fit-overlap" key={i}>{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer">{o.title} {o.year ? `(${o.year})` : ''} <ExternalLink size={12} /></a> : <strong>{o.title}</strong>}<p>{o.why}</p></div>)}</section> : null}
    {report.strengths.length ? <section><h4><CheckCircle2 size={15} /> Strengths</h4><ul className="fit-strengths">{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></section> : null}
    {g ? <section className="fit-guide"><h4>From the journal&apos;s author guidelines</h4>
      <div className="fit-guide-grid">
        {type ? <div><span>Article type</span><strong>{type.name}</strong></div> : null}
        {type?.wordLimit ? <div><span>Word limit</span><strong>{type.wordLimit.toLocaleString('en-US')}</strong></div> : null}
        {type?.pageLimit ? <div><span>Page limit</span><strong>{type.pageLimit}</strong></div> : null}
        {(type?.abstractLimit ?? g.abstractMaxWords) ? <div><span>Abstract</span><strong>≤ {type?.abstractLimit ?? g.abstractMaxWords} words{g.structuredAbstract ? ', structured' : ''}</strong></div> : null}
        {g.keywordsMax ? <div><span>Keywords</span><strong>{[g.keywordsMin, g.keywordsMax].filter(Boolean).join('–')}</strong></div> : null}
        {g.highlights ? <div><span>Highlights</span><strong>Required</strong></div> : null}
        {g.graphicalAbstract ? <div><span>Graphical abstract</span><strong>Required</strong></div> : null}
        {g.reviewType ? <div><span>Peer review</span><strong>{g.reviewType}</strong></div> : null}
      </div>
      {g.requiredStatements.length ? <p><b>Required statements:</b> {g.requiredStatements.join(' · ')}</p> : null}
      {g.otherRequirements.length ? <p><b>Also needed:</b> {g.otherRequirements.join(' · ')}</p> : null}
      {g.referenceStyle ? <p><b>References:</b> {g.referenceStyle}</p> : null}
      <a className="metric-source" href={g.sourceUrl} target="_blank" rel="noopener noreferrer">Source: {new URL(g.sourceUrl).hostname.replace(/^www\./, '')} <ExternalLink size={11} /></a>
    </section> : report.guidelinesError ? <div className="alert alert-warning"><AlertCircle size={16} /> {report.guidelinesError} The structure check used general expectations instead.</div> : null}
    <p className="fit-notice"><Sparkles size={13} /> {report.notice}</p>
  </div>;
}

/** "Check fit" button plus the report it opens, shown inside a journal card. */
export function FitCheck({ journal, context }: { journal: Journal; context?: FitContext }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; report?: Report; error?: string }>({ status: 'idle' });
  const [open, setOpen] = useState(false);
  if (!context) return <span className="fit-hint">Upload your manuscript or add an abstract to check fit with this journal.</span>;
  async function run() {
    setOpen(true); if (state.status === 'done' || state.status === 'loading') return;
    setState({ status: 'loading' });
    try {
      const response = await fetch('/api/fit-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ journal: { id: journal.id, name: journal.name, publisher: journal.publisher, homepage: journal.homepage, issn: journal.issn }, ...context }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Fit check failed.');
      setState({ status: 'done', report: data });
    } catch (e) { setState({ status: 'error', error: e instanceof Error ? e.message : 'Fit check failed.' }); }
  }
  return <>
    <button className="btn btn-dark fit-button" onClick={() => open && state.status !== 'idle' ? setOpen(false) : void run()}>
      {state.status === 'loading' ? <LoaderCircle className="spin" size={15} /> : <FileSearch size={15} />} {open && state.status === 'done' ? 'Hide fit report' : context.mode === 'manuscript' ? 'Check fit with my manuscript' : 'Check fit with my abstract'}
    </button>
    {open ? <div className="fit-panel">
      {state.status === 'loading' ? <div className="loading-state"><LoaderCircle className="spin" size={28} /><strong>Reviewing against {journal.name}</strong><p>Reading the journal&apos;s author guidelines, comparing your {context.mode === 'manuscript' ? 'manuscript' : 'abstract'} with them and with the closest recent papers. This takes 10–40 seconds.</p></div> : null}
      {state.status === 'error' ? <div className="alert alert-danger"><AlertCircle size={16} /> {state.error} <button className="text-btn" onClick={() => { setState({ status: 'idle' }); void run(); }}>Retry</button></div> : null}
      {state.report ? <FitReportView report={state.report} /> : null}
    </div> : null}
  </>;
}
