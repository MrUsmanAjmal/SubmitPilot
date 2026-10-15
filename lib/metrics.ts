import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { JournalMetrics } from './types';

/*
 * Journal metrics from three free sources:
 *  - SCImago Journal Rank (data/scimago.csv, downloaded manually from scimagojr.com): best
 *    quartile, SJR, H-index, citations per document (2 years, an Impact-Factor-like ratio),
 *    subject categories. Absence from the file means the journal is not indexed in Scopus.
 *  - Elsevier Scopus Serial Title API (optional ELSEVIER_API_KEY): official CiteScore, its subject
 *    percentile and quartile, SJR, SNIP, and whether Scopus indexes the journal at all.
 *  - OpenAlex source records: 2-year mean citedness, H-index, APC and DOAJ status.
 * Clarivate's Journal Impact Factor is proprietary and is never shown or estimated.
 */

type ScimagoRow = { sjr: number | null; quartile: string | null; hIndex: number | null; citesPerDoc2y: number | null; categories: string[]; title: string };
let scimago: { rows: Map<string, ScimagoRow>; loadedFrom: string; mtime: number } | null = null;

export const normalizeIssn = (issn: string) => issn.replace(/[^0-9xX]/g, '').toUpperCase();
const num = (v: string | undefined) => { if (!v) return null; const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const decimal = (v: string | undefined) => { if (!v) return null; const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : null; };

/** Splits one semicolon-separated SCImago line, honouring double quotes. */
export function splitScimagoLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (ch === ';' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out.map(s => s.trim());
}

export function parseScimago(csv: string): Map<string, ScimagoRow> {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const header = splitScimagoLine(lines[0] || '');
  const col = (name: RegExp) => header.findIndex(h => name.test(h));
  const c = { title: col(/^Title$/i), type: col(/^Type$/i), issn: col(/^Issn$/i), sjr: col(/^SJR$/i), quartile: col(/Best Quartile/i), h: col(/^H index$/i), cites: col(/Citations \/ Doc\. \(2years\)/i), categories: col(/^Categories$/i) };
  const rows = new Map<string, ScimagoRow>();
  if (c.issn < 0) return rows;
  for (const line of lines.slice(1)) {
    const f = splitScimagoLine(line);
    if (c.type >= 0 && f[c.type] && !/journal/i.test(f[c.type])) continue;
    const quartile = (f[c.quartile] || '').toUpperCase();
    const row: ScimagoRow = {
      title: f[c.title] || '', sjr: decimal(f[c.sjr]), quartile: /^Q[1-4]$/.test(quartile) ? quartile : null, hIndex: num(f[c.h]),
      citesPerDoc2y: decimal(f[c.cites]), categories: (f[c.categories] || '').split(';').map(s => s.trim()).filter(Boolean),
    };
    for (const issn of (f[c.issn] || '').split(',')) { const key = normalizeIssn(issn); if (key.length === 8 && key !== '00000000') rows.set(key, row); }
  }
  return rows;
}

/** Loads data/scimago.csv (or SCIMAGO_CSV_PATH) once and reloads it when the file changes. */
export function scimagoTable(): Map<string, ScimagoRow> | null {
  const file = process.env.SCIMAGO_CSV_PATH || path.join(process.cwd(), 'data', 'scimago.csv');
  if (!existsSync(file)) return null;
  const mtime = statSync(file).mtimeMs;
  if (!scimago || scimago.loadedFrom !== file || scimago.mtime !== mtime) scimago = { rows: parseScimago(readFileSync(file, 'utf8')), loadedFrom: file, mtime };
  return scimago.rows;
}

/** Scopus record for one ISSN. `found: false` means Scopus answered that it does not index this ISSN. */
type Scopus = { found: boolean; citeScore: number | null; year: string | null; snip: number | null; sjr: number | null; percentile: number | null; quartile: JournalMetrics['quartile']; subject: string | null; openAccess?: boolean | null; authorPaidOA?: boolean | null };
const scopusCache = new Map<string, { at: number; value: Scopus | null }>();
let scopusActive = 0; const scopusWaiting: (() => void)[] = [];
/** Elsevier allows a few requests per second per key, so at most 4 run at once. */
async function scopusSlot<T>(run: () => Promise<T>): Promise<T> {
  if (scopusActive >= 4) await new Promise<void>(r => scopusWaiting.push(r));
  scopusActive++;
  try { return await run(); } finally { scopusActive--; scopusWaiting.shift()?.(); }
}
/** CiteScore quartile from the best subject percentile, as Scopus defines it (Q1 = 75th percentile or above). */
export const percentileQuartile = (p: number | null): JournalMetrics['quartile'] => p == null ? null : p >= 75 ? 'Q1' : p >= 50 ? 'Q2' : p >= 25 ? 'Q3' : 'Q4';
type ScopusEntry = { openaccess?: string | null; oaAllowsAuthorPaid?: boolean | null; 'subject-area'?: { '@code'?: string; $?: string }[]; SNIPList?: { SNIP?: { $?: string }[] }; SJRList?: { SJR?: { $?: string }[] }; citeScoreYearInfoList?: { citeScoreCurrentMetric?: string; citeScoreCurrentMetricYear?: string; citeScoreYearInfo?: { '@year'?: string; citeScoreInformationList?: { citeScoreInfo?: { citeScoreSubjectRank?: { subjectCode?: string; percentile?: string }[] }[] }[] }[] } };
export function parseScopusEntry(entry: ScopusEntry): Scopus {
  const info = entry.citeScoreYearInfoList; const year = info?.citeScoreCurrentMetricYear || null;
  const yearInfo = (info?.citeScoreYearInfo || []).find(y => y['@year'] === year);
  const ranks = (yearInfo?.citeScoreInformationList || []).flatMap(i => i.citeScoreInfo || []).flatMap(c => c.citeScoreSubjectRank || []);
  const best = ranks.map(r => ({ code: r.subjectCode, p: Number(r.percentile) })).filter(r => Number.isFinite(r.p)).sort((a, b) => b.p - a.p)[0];
  const subject = best ? (entry['subject-area'] || []).find(s => s['@code'] === best.code)?.$ || null : null;
  const n = (v: string | undefined) => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  return { found: true, citeScore: n(info?.citeScoreCurrentMetric), year, snip: n(entry.SNIPList?.SNIP?.[0]?.$), sjr: n(entry.SJRList?.SJR?.[0]?.$), percentile: best?.p ?? null, quartile: percentileQuartile(best?.p ?? null), subject,
    openAccess: entry.openaccess === '1' ? true : entry.openaccess === '0' ? false : null, authorPaidOA: typeof entry.oaAllowsAuthorPaid === 'boolean' ? entry.oaAllowsAuthorPaid : null };
}
async function fetchScopus(issn: string): Promise<Scopus | null> {
  const key = process.env.ELSEVIER_API_KEY; if (!key) return null;
  const cached = scopusCache.get(issn); if (cached && Date.now() - cached.at < 7 * 864e5) return cached.value;
  let value: Scopus | null = null;
  try {
    value = await scopusSlot(async () => {
      const get = async () => {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
        return fetch(`https://api.elsevier.com/content/serial/title/issn/${issn}?view=CITESCORE`, { signal: controller.signal, headers: { Accept: 'application/json', 'X-ELS-APIKey': key } }).finally(() => clearTimeout(timer));
      };
      let response = await get();
      // Elsevier throttles bursts; one short retry recovers most 429s.
      if (response.status === 429) { await new Promise(r => setTimeout(r, 1200)); response = await get(); }
      if (response.status === 404) return { found: false, citeScore: null, year: null, snip: null, sjr: null, percentile: null, quartile: null, subject: null };
      if (!response.ok) return null; // quota or outage: unknown, not "not indexed"
      const entry = (await response.json())?.['serial-metadata-response']?.entry?.[0];
      return entry ? parseScopusEntry(entry) : null;
    });
  } catch { value = null; }
  if (value) scopusCache.set(issn, { at: Date.now(), value });
  return value;
}
/** Tries each ISSN (print and electronic) until Scopus recognises one. "Not indexed" only when every ISSN got a definite 404. */
async function scopusRecord(issns: string[]): Promise<Scopus | null> {
  let notFound = 0; const tried = issns.slice(0, 3);
  for (const i of tried) {
    const r = await fetchScopus(`${i.slice(0, 4)}-${i.slice(4)}`);
    if (r?.found) return r;
    if (r && !r.found) notFound++;
  }
  return tried.length && notFound === tried.length ? { found: false, citeScore: null, year: null, snip: null, sjr: null, percentile: null, quartile: null, subject: null } : null;
}

/** Publishing model from OpenAlex (is_oa, DOAJ, APC) and Scopus (open-access flag, paid OA option). */
export function accessModel(s: { isOa?: boolean | null; inDoaj?: boolean | null; apcUsd?: number | null; scopusOpenAccess?: boolean | null; authorPaidOA?: boolean | null }): JournalMetrics['accessModel'] {
  const fullyOpen = !!(s.isOa || s.inDoaj || s.scopusOpenAccess);
  if (fullyOpen) return s.apcUsd === 0 ? 'open-access-free' : s.apcUsd != null && s.apcUsd > 0 ? 'open-access-apc' : s.inDoaj ? 'open-access-free' : 'open-access-apc';
  if ((s.apcUsd != null && s.apcUsd > 0) || s.authorPaidOA) return 'hybrid';
  if (s.isOa === false || s.scopusOpenAccess === false) return 'subscription';
  return 'unknown';
}
export type OpenAlexMetricSource = { is_oa?: boolean | null; issn?: string[] | null; issn_l?: string | null; summary_stats?: { '2yr_mean_citedness'?: number; h_index?: number } | null; apc_usd?: number | null; is_in_doaj?: boolean | null };
export async function journalMetrics(source: OpenAlexMetricSource): Promise<JournalMetrics> {
  const issns = [...new Set([source.issn_l, ...(source.issn || [])].filter(Boolean).map(i => normalizeIssn(String(i))))].filter(i => i.length === 8);
  const table = scimagoTable();
  const row = table ? issns.map(i => table.get(i)).find(Boolean) || null : null;
  const sc = issns.length ? await scopusRecord(issns) : null;
  const indexed = row || sc?.found ? 'scopus' : (sc && !sc.found) || table ? 'not-indexed' : 'unknown';
  return {
    quartile: (row?.quartile as JournalMetrics['quartile']) || null, indexed,
    sjr: row?.sjr ?? sc?.sjr ?? null, scimagoHIndex: row?.hIndex ?? null, citesPerDoc2y: row?.citesPerDoc2y ?? null, categories: row?.categories.slice(0, 4) || (sc?.subject ? [sc.subject] : []),
    citeScore: sc?.citeScore ?? null, citeScoreYear: sc?.year ?? null, snip: sc?.snip ?? null,
    citeScoreQuartile: sc?.quartile ?? null, citeScorePercentile: sc?.percentile ?? null, citeScoreSubject: sc?.subject ?? null,
    openAlexCitedness2y: source.summary_stats?.['2yr_mean_citedness'] != null ? Math.round(source.summary_stats['2yr_mean_citedness'] * 100) / 100 : null,
    openAlexHIndex: source.summary_stats?.h_index ?? null, apcUsd: source.apc_usd ?? null, inDoaj: source.is_in_doaj ?? null,
    accessModel: accessModel({ isOa: source.is_oa, inDoaj: source.is_in_doaj, apcUsd: source.apc_usd, scopusOpenAccess: sc?.openAccess, authorPaidOA: sc?.authorPaidOA }),
  };
}
export const QUARTILE_ORDER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
