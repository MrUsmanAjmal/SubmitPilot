'use client';
import { useState } from 'react';
import { Layers, Type } from 'lucide-react';
import { DiscoveryResults, FieldSearch, TopicSearch, useDiscovery } from './Discovery';

/** Public venue search (field or topic) used outside the workspace. */
export default function VenueFinder() {
  const [mode, setMode] = useState<'field' | 'topic'>('topic');
  const [searchedMode, setSearchedMode] = useState<'field' | 'topic'>('topic');
  const discovery = useDiscovery();
  const busy = discovery.stage === 'keywords' || discovery.stage === 'searching';
  return <div className="explorer">
    <div className="tab-toggle">
      <button className={mode === 'topic' ? 'selected' : ''} onClick={() => setMode('topic')}><Type size={16} /> Topic &amp; abstract</button>
      <button className={mode === 'field' ? 'selected' : ''} onClick={() => setMode('field')}><Layers size={16} /> Search by field</button>
    </div>
    {mode === 'field'
      ? <FieldSearch busy={busy} onSearch={(id, name) => { setSearchedMode('field'); void discovery.run({ mode: 'field', fieldId: id, fieldName: name }); }} />
      : <TopicSearch busy={busy} onSearch={(topic, abstract) => { setSearchedMode('topic'); void discovery.run({ mode: 'topic', topic, abstract }); }} />}
    <DiscoveryResults key={searchedMode} discovery={discovery} fieldMode={searchedMode === 'field'} />
  </div>;
}
