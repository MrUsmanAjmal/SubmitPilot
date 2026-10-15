'use client';
import type { ResearchEvent } from '@/lib/types';
import { CalendarDays, ClipboardList, ExternalLink, MapPin, Timer } from 'lucide-react';

const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;
const SOURCE_LABEL: Record<ResearchEvent['source'], string> = { 'ccf-deadlines': 'ccf-deadlines (curated)', wikicfp: 'WikiCFP', 'ai-web': 'AI web search' };

function StatusBadge({ event }: { event: ResearchEvent }) {
  if (event.status === 'upcoming') return <span className="status status-open"><Timer size={13} /> {event.daysLeft === 0 ? 'Due today' : `${event.daysLeft} day${event.daysLeft === 1 ? '' : 's'} left`}</span>;
  if (event.status === 'tba') return <span className="status status-tba">Deadline not announced</span>;
  return <span className="status status-passed">Deadline passed</span>;
}

export default function EventCard({ event }: { event: ResearchEvent }) {
  const ranked = event.rank.core || event.rank.ccf;
  return <article className={`journal-card event-card event-${event.status}`}>
    <div className="event-top">
      <div className="journal-head">
        <div className="journal-overline">{event.kind === 'workshop' ? 'WORKSHOP' : 'CONFERENCE'} · {SOURCE_LABEL[event.source]}</div>
        <h3>{event.acronym ? `${event.acronym}${event.year ? ` ${event.year}` : ''}` : event.name}</h3>
        {event.acronym ? <p className="event-name">{event.name}</p> : null}
      </div>
      <div className="event-badges">
        <StatusBadge event={event} />
        <div className="rank-row">
          {event.rank.core ? <span className="rank" title="CORE conference ranking">CORE {event.rank.core}</span> : null}
          {event.rank.ccf ? <span className="rank" title="China Computer Federation ranking">CCF {event.rank.ccf}</span> : null}
          {!ranked ? <span className="rank rank-none" title="No CORE or CCF rank found. Check the organiser and proceedings before submitting.">Unranked</span> : null}
        </div>
      </div>
    </div>
    <div className="event-facts">
      <div><span>PAPER DEADLINE</span><strong>{day(event.deadline) || 'TBA'}</strong>{event.abstractDeadline && event.abstractDeadline !== event.deadline ? <small>Abstract: {day(event.abstractDeadline)}</small> : null}</div>
      <div><span><CalendarDays size={12} /> EVENT DATES</span><strong>{event.eventDates || '—'}</strong></div>
      <div><span><MapPin size={12} /> LOCATION</span><strong>{event.location || '—'}</strong></div>
    </div>
    {event.deadlineNote ? <p className="event-note">{event.deadlineNote}</p> : null}
    {event.criteria ? <div className="event-criteria"><ClipboardList size={15} /><div><span className="label-small">SUBMISSION CRITERIA (FROM THE CALL FOR PAPERS)</span><p>{event.criteria}</p></div></div> : null}
    <div className="journal-actions">
      {event.url ? <a className="text-btn" href={event.url} target="_blank" rel="noopener noreferrer">Official call for papers <ExternalLink size={14} /></a> : null}
      {event.sourceUrl && event.sourceUrl !== event.url ? <a className="text-btn subdued" href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{SOURCE_LABEL[event.source]} <ExternalLink size={14} /></a> : null}
    </div>
  </article>;
}
