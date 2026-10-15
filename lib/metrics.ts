import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { JournalMetrics } from './types';

/*
 * Journal metrics from three free sources:
 *  - SCImago Journal Rank (data/scimago.csv, downloaded manually from scimagojr.com): best
 *    quartile, SJR, H-index, citations per document (2 years, an Impact-Factor-like ratio),
 *    subject categories. Absence from the file means the journal is not indexed in Scopus.
 *  - Elsevier Scopus Serial Title API (optional ELSEVIER_API_KEY): official CiteScore and SNIP.
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

type CiteScore = { citeScore: number | null; year: string | null; snip: number | null };
const citeScoreCache = new Map<string, { at: number; value: CiteScore | null }>();
async function fetchCiteScore(issn: string): Promise<CiteScore | null> {
  const key = process.env.ELSEVIER_API_KEY; if (!key) return null;
  const cached = citeScoreCache.get(issn); if (cached && Date.now() - cached.at < 864e5) return cached.value;
  let value: CiteScore | null = null;
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`https://api.elsevier.com/content/serial/title/issn/${issn}?view=STANDARD`, { signal: controller.signal, headers: { Accept: 'application/json', 'X-ELS-APIKey': key } }).finally(() => clearTimeout(timer));
    if (response.ok) {
      const body = await response.json();
      const entry = body?.['serial-metadata-response']?.entry?.[0];
      const info = entry?.citeScoreYearInfoList;
      const snip = entry?.SNIPList?.SNIP?.[0]?.['$'];
      value = { citeScore: info?.citeScoreCurrentMetric ? Number(info.citeScoreCurrentMetric) : null, year: info?.citeScoreCurrentMetricYear || null, snip: snip ? Number(snip) : null };
    }
  } catch { value = null; }
  citeScoreCache.set(issn, { at: Date.now(), value });
  return value;
}

export type OpenAlexMetricSource = { issn?: string[] | null; issn_l?: string | null; summary_stats?: { '2yr_mean_citedness'?: number; h_index?: number } | null; apc_usd?: number | null; is_in_doaj?: boolean | null };
export async function journalMetrics(source: OpenAlexMetricSource): Promise<JournalMetrics> {
  const issns = [...new Set([source.issn_l, ...(source.issn || [])].filter(Boolean).map(i => normalizeIssn(String(i))))].filter(i => i.length === 8);
  const table = scimagoTable();
  const row = table ? issns.map(i => table.get(i)).find(Boolean) || null : null;
  const cs = issns.length ? await fetchCiteScore(`${issns[0].slice(0, 4)}-${issns[0].slice(4)}`) : null;
  const indexed = row || cs?.citeScore != null ? 'scopus' : table ? 'not-indexed' : 'unknown';
  return {
    quartile: (row?.quartile as JournalMetrics['quartile']) || null, indexed,
    sjr: row?.sjr ?? null, scimagoHIndex: row?.hIndex ?? null, citesPerDoc2y: row?.citesPerDoc2y ?? null, categories: row?.categories.slice(0, 4) || [],
    citeScore: cs?.citeScore ?? null, citeScoreYear: cs?.year ?? null, snip: cs?.snip ?? null,
    openAlexCitedness2y: source.summary_stats?.['2yr_mean_citedness'] != null ? Math.round(source.summary_stats['2yr_mean_citedness'] * 100) / 100 : null,
    openAlexHIndex: source.summary_stats?.h_index ?? null, apcUsd: source.apc_usd ?? null, inDoaj: source.is_in_doaj ?? null,
  };
}
export const QUARTILE_ORDER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
