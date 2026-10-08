export type Severity = 'info' | 'attention' | 'positive';
export type Check = { id: string; label: string; detail: string; status: Severity; evidence?: string };
export type Analysis = {
  title:string; summary:string; studyType:string; discipline:string; keywords:string[];
  strengths:string[]; considerations:string[]; checks:Check[];
  wordCount:number; estimatedReadMinutes:number; mode:'claude'|'rules';
  notice:string;
};
export type SampleWork = { title:string; year:number | null; doi:string | null; url:string; type:string };
export type Journal = {
  id:string; name:string; issn:string|null; publisher:string|null; openAccess:boolean|null;
  count:number; score:number; fitLabel:string; designEvidence:string; works:SampleWork[]; openalexUrl:string;
  reason:string; verification:string;
};
export type JournalResponse = { journals:Journal[]; searched:string; sampledWorks:number; notice:string; error?:string };
export type WorkspaceSession = { analysis:Analysis; text:string; fileName:string; updatedAt:number };
