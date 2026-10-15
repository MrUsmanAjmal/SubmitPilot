import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScimago, normalizeIssn, parseScopusEntry, percentileQuartile } from '../lib/metrics';
import { ccfToEvent, parseDeadline, parseWikicfp, relevance, statusOf } from '../lib/events';
import { expiryFor, parsePublisherMetrics, verifyAgainstResults } from '../lib/impact';
import { accessModel } from '../lib/metrics';

test('parses the SCImago CSV with decimal commas and multiple ISSNs', () => {
  const csv = 'Rank;Sourceid;Title;Type;Issn;SJR;SJR Best Quartile;H index;Citations / Doc. (2years);Categories\n' +
    '1;123;"Image and Vision Computing";journal;"02628856, 18728138";1,234;Q1;183;6,47;"Computer Vision and Pattern Recognition (Q1); Signal Processing (Q1)"\n' +
    '2;456;Some Proceedings;conference and proceedings;12345678;0,2;-;5;0,1;X\n';
  const rows = parseScimago(csv);
  const ivc = rows.get(normalizeIssn('1872-8138'));
  assert.ok(ivc);
  assert.equal(ivc.quartile, 'Q1'); assert.equal(ivc.sjr, 1.234); assert.equal(ivc.citesPerDoc2y, 6.47); assert.equal(ivc.hIndex, 183);
  assert.equal(ivc.categories.length, 2);
  assert.equal(rows.has('12345678'), false);
});

test('converts deadlines from organiser time zones and classifies status', () => {
  const aoe = parseDeadline('2026-11-17 23:59:59', 'AoE');
  assert.equal(aoe?.toISOString(), '2026-11-18T11:59:59.000Z');
  assert.equal(parseDeadline('TBD'), null);
  const now = Date.UTC(2026, 9, 16);
  assert.equal(statusOf(aoe, now).status, 'upcoming');
  assert.equal(statusOf(new Date(Date.UTC(2026, 0, 1)), now).status, 'passed');
  assert.equal(statusOf(null, now).status, 'tba');
});

test('uses the next open round of the latest edition from ccf-deadlines', () => {
  const now = Date.UTC(2026, 9, 16);
  const e = ccfToEvent({ title: 'CVPR', description: 'IEEE/CVF Conference on Computer Vision and Pattern Recognition', sub: 'AI', rank: { ccf: 'A', core: 'A*' },
    confs: [{ year: 2026, timeline: [{ deadline: '2025-11-13 23:59:59' }], timezone: 'UTC-8' }, { year: 2027, link: 'https://cvpr.thecvf.com', timeline: [{ deadline: '2026-11-17 23:59:59' }], timezone: 'UTC-8', date: 'June 2027', place: 'Seattle' }] }, now);
  assert.ok(e);
  assert.equal(e.year, 2027); assert.equal(e.status, 'upcoming'); assert.equal(e.location, 'Seattle'); assert.equal(e.rank.core, 'A*');
});

test('parses WikiCFP rows and recognises co-located workshops', () => {
  const html = `<tr bgcolor="#f6f6f6"><td rowspan="2" align="left"><a href="/cfp/servlet/event.showcfp?eventid=11&amp;copyownerid=2">CVPath@WACV 2027</a></td>
<td align="left" colspan="3">Workshop on Computer Vision for Pathology</td></tr>
<tr bgcolor="#f6f6f6">
<td align="left">Mar 3, 2027 - Mar 7, 2027</td>
<td align="left">Orlando, USA</td>
<td align="left">Nov 2, 2026 (Oct 26, 2026)</td>
</tr>`;
  const [e] = parseWikicfp(html, Date.UTC(2026, 9, 16));
  assert.equal(e.kind, 'workshop'); assert.equal(e.acronym, 'CVPath@WACV'); assert.equal(e.year, 2027);
  assert.equal(e.location, 'Orlando, USA'); assert.equal(e.status, 'upcoming'); assert.ok(e.abstractDeadline);
});

test('derives the Scopus CiteScore quartile from the best subject percentile', () => {
  const s = parseScopusEntry({
    'subject-area': [{ '@code': '1711', $: 'Signal Processing' }, { '@code': '1707', $: 'Computer Vision and Pattern Recognition' }],
    SJRList: { SJR: [{ $: '0.881' }] }, SNIPList: { SNIP: [{ $: '1.314' }] },
    citeScoreYearInfoList: { citeScoreCurrentMetric: '7.7', citeScoreCurrentMetricYear: '2025', citeScoreYearInfo: [
      { '@year': '2026', citeScoreInformationList: [{ citeScoreInfo: [{ citeScoreSubjectRank: [{ subjectCode: '1711', percentile: '99' }] }] }] },
      { '@year': '2025', citeScoreInformationList: [{ citeScoreInfo: [{ citeScoreSubjectRank: [{ subjectCode: '1711', percentile: '88' }, { subjectCode: '1707', percentile: '84' }] }] }] }] },
  });
  assert.equal(s.citeScore, 7.7); assert.equal(s.year, '2025'); assert.equal(s.sjr, 0.881);
  assert.equal(s.percentile, 88); assert.equal(s.quartile, 'Q1'); assert.equal(s.subject, 'Signal Processing');
  assert.equal(percentileQuartile(50), 'Q2'); assert.equal(percentileQuartile(24), 'Q4');
});

test('keeps only well-formed publisher metrics for requested journals', () => {
  const text = 'Here you go:\n[{"id":"S177430994","impactFactor":5.0,"impactFactorYear":"2024","citeScore":7.7,"citeScoreYear":2024,"scopusQuartile":"Q1","jcrQuartile":null,"sourceUrl":"https://www.sciencedirect.com/journal/image-and-vision-computing"},' +
    '{"id":"S999","impactFactor":9.9},{"id":"S414566","impactFactor":null,"citeScore":null,"sourceUrl":"not a url"}]';
  const map = parsePublisherMetrics(text, ['S177430994', 'S414566']);
  const ivc = map.get('S177430994');
  assert.equal(ivc?.impactFactor, 5); assert.equal(ivc?.citeScore, 7.7); assert.equal(ivc?.scopusQuartile, 'Q1'); assert.equal(ivc?.impactFactorYear, '2024');
  assert.equal(map.has('S999'), false);
  assert.equal(map.get('S414566')?.impactFactor, null); assert.equal(map.get('S414566')?.sourceUrl, null);
});

test('keeps a looked-up number only when the cited page text contains it', () => {
  const results = [{ url: 'https://a.example/ivc', title: 'Image and Vision Computing', text: 'CiteScore 7.7 Impact Factor 5.0', provider: 'test' }];
  const base = { impactFactorYear: '2024', citeScoreYear: '2025', scopusQuartile: null, jcrQuartile: null, checkedAt: '' };
  const ok = verifyAgainstResults({ ...base, impactFactor: 5, citeScore: 7.7, sourceUrl: 'https://a.example/ivc' }, results);
  assert.equal(ok.impactFactor, 5); assert.equal(ok.citeScore, 7.7);
  const invented = verifyAgainstResults({ ...base, impactFactor: 4.2, citeScore: 7.7, sourceUrl: 'https://a.example/ivc' }, results);
  assert.equal(invented.impactFactor, null); assert.equal(invented.impactFactorYear, null); assert.equal(invented.citeScore, 7.7);
});

test('saved Impact Factors expire on July 1 after the June JCR release', () => {
  assert.equal(new Date(expiryFor(true, new Date(Date.UTC(2026, 9, 16)))).toISOString().slice(0, 10), '2027-07-01');
  assert.equal(new Date(expiryFor(true, new Date(Date.UTC(2027, 2, 1)))).toISOString().slice(0, 10), '2027-07-01');
});

test('classifies hybrid, open-access and free-to-publish journals', () => {
  assert.equal(accessModel({ isOa: false, apcUsd: 2100, authorPaidOA: true }), 'hybrid');
  assert.equal(accessModel({ isOa: true, inDoaj: true, apcUsd: 2382 }), 'open-access-apc');
  assert.equal(accessModel({ isOa: true, inDoaj: true, apcUsd: 0 }), 'open-access-free');
  assert.equal(accessModel({ isOa: false, apcUsd: null }), 'subscription');
});

test('relevance rewards full phrase matches', () => {
  assert.ok(relevance('Conference on Computer Vision and Pattern Recognition', ['computer vision'], []) >= 3);
  assert.equal(relevance('Conference on Software Testing', ['computer vision'], ['tracking']), 0);
});
