import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { tracker, errMsg, isUnconfigured } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Input, { Field } from '../components/Input.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 20;

function AssetGrid({ assets }) {
  if (!assets?.length) {
    return <EmptyState icon="▭" title="No assets found" body="Try a different search term." />;
  }
  return (
    <div className="grid grid-4">
      {assets.map((a) => (
        <div key={a.id} className="card" style={{ padding: '0.75rem' }}>
          {a.thumbnail && (
            <img src={a.thumbnail} alt={a.title || 'Stock asset'} style={{ width: '100%', borderRadius: 8, marginBottom: '0.5rem' }} loading="lazy" />
          )}
          <div className="small" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.title}>
            {a.title || 'Untitled'}
          </div>
          <div className="tiny text-faint mono">{a.id}</div>
        </div>
      ))}
    </div>
  );
}

export default function Tracker() {
  const [tab, setTab] = useState('search');
  const [q, setQ] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [submitted, setSubmitted] = useState(null); // {kind:'search'|'contributor', term}
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['tracker', submitted?.kind, submitted?.term, page],
    queryFn: () =>
      submitted.kind === 'search'
        ? tracker.search(submitted.term, PAGE_SIZE, (page - 1) * PAGE_SIZE)
        : tracker.contributor(submitted.term, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    enabled: !!submitted,
    retry: 1,
  });

  const unconfigured = query.isError && isUnconfigured(query.error);
  const assets = query.data?.assets || [];
  const total = query.data?.total ?? assets.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const runSearch = (e) => {
    e.preventDefault();
    if (!q.trim()) return toast.warn('Type something to search for.');
    setPage(1);
    setSubmitted({ kind: 'search', term: q.trim() });
  };

  const runContributor = (e) => {
    e.preventDefault();
    if (!creatorId.trim()) return toast.warn('Enter a contributor ID.');
    setPage(1);
    setSubmitted({ kind: 'contributor', term: creatorId.trim() });
  };

  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Tracker</h2>
        <p className="text-muted">Look up stock assets and contributors.</p>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'search'} className={`tab${tab === 'search' ? ' active' : ''}`} onClick={() => setTab('search')}>
          Asset search
        </button>
        <button role="tab" aria-selected={tab === 'contributor'} className={`tab${tab === 'contributor' ? ' active' : ''}`} onClick={() => setTab('contributor')}>
          Contributor lookup
        </button>
      </div>

      <Card>
        {tab === 'search' ? (
          <form onSubmit={runSearch} className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field label="Search assets" htmlFor="tracker-q">
                <Input id="tracker-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. mountain sunrise" />
              </Field>
            </div>
            <Button type="submit" disabled={query.isFetching}>Search</Button>
          </form>
        ) : (
          <form onSubmit={runContributor} className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field label="Contributor ID" htmlFor="tracker-creator">
                <Input id="tracker-creator" value={creatorId} onChange={(e) => setCreatorId(e.target.value)} placeholder="Creator ID" />
              </Field>
            </div>
            <Button type="submit" disabled={query.isFetching}>Look up</Button>
          </form>
        )}
      </Card>

      {unconfigured && (
        <Card>
          <EmptyState
            icon="⚙"
            title="Tracker isn't configured"
            body="Tracker needs an Adobe Stock API key — see the Setup Guide to add one."
          />
        </Card>
      )}

      {query.isError && !unconfigured && (
        <div className="warn-box" role="alert">{errMsg(query.error, 'Tracker lookup failed.')}</div>
      )}

      {query.isFetching && !query.data && <SkeletonCard />}

      {query.data && (
        <div className="stack">
          <p className="small text-muted">
            {total} result{total === 1 ? '' : 's'}
            {submitted ? ` for “${submitted.term}”` : ''}
          </p>
          <AssetGrid assets={assets} />
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      )}

      {!submitted && !query.data && (
        <EmptyState icon="◌" title="Nothing to show yet" body="Search for assets or look up a contributor above." />
      )}
    </div>
  );
}
