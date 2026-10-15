export type Severity = 'info' | 'attention' | 'positive';
export type Check = { id: string; label: string; detail: string; status: Severity; evidence?: string };
export type Analysis = {
  title:string; summary:string; studyType:string; discipline:string; keywords:string[];
  strengths:string[]; considerations:string[]; checks:Check[];
  wordCount:number; estimatedReadMinutes:number; mode:'ai'|'rules';
  notice:string;
};
export type JournalMetrics = {
  quartile:'Q1'|'Q2'|'Q3'|'Q4'|null; indexed:'scopus'|'not-indexed'|'unknown';
  sjr:number|null; scimagoHIndex:number|null; citesPerDoc2y:number|null; categories:string[];
  citeScore:number|null; citeScoreYear:string|null; snip:number|null;
  openAlexCitedness2y:number|null; openAlexHIndex:number|null; apcUsd:number|null; inDoaj:boolean|null;
};
export type SampleWork = { title:string; year:number | null; doi:string | null; url:string; type:string };
export type Journal = {
  id:string; name:string; issn:string|null; publisher:string|null; openAccess:boolean|null; homepage:string|null;
  score:number; fitLabel:string; topicWorks:number; keywordWorks:number; focusPercent:number; scopeTopics:string[];
  designEvidence:string; metrics:JournalMetrics; works:SampleWork[]; openalexUrl:string; aiFit:{score:number;reason:string}|null;
  reason:string; verification:string;
};
export type JournalResponse = { journals:Journal[]; searched:string; topics:string[]; sampledWorks:number; mode:'ai'|'rules'; aiError?:string; notice:string; metricsNote:string; error?:string };
export type DeadlineStatus = 'upcoming'|'passed'|'tba';
export type ResearchEvent = {
  id:string; kind:'conference'|'workshop'; acronym:string; name:string; year:number|null; url:string|null;
  deadline:string|null; abstractDeadline:string|null; deadlineNote:string|null; status:DeadlineStatus; daysLeft:number|null;
  eventDates:string|null; location:string|null; rank:{core?:string;ccf?:string}; criteria:string|null; relevance:number;
  source:'ccf-deadlines'|'wikicfp'|'ai-web'; sourceUrl:string|null;
};
export type EventsResponse = { conferences:ResearchEvent[]; workshops:ResearchEvent[]; searched:string[]; webSources:{title:string;url:string}[]; aiError?:string; notice:string };
export type WorkspaceSession = { analysis:Analysis; text:string; fileName:string; updatedAt:number };
