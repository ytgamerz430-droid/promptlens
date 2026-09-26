import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { jobs, errMsg } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import { Select, Field } from '../components/Input.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import CopyButton from '../components/CopyButton.jsx';
import { StatusBadge } from '../components/Badge.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

const TOOLS = [
  { id: '', label: 'All tools' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'deep', label: 'Deep analysis' },
  { id: 'ip-risk', label: 'IP risk' },
  { id: 'tracker-search', label: 'Tracker search' },
  { id: 'tracker-contributor', label: 'Tracker contributor' },
];
const STATUSES = [
  { id: '', label: 'All statuses' },
  { id: 'queued', label: 'Queued' },
  { id: 'processing', label: 'Processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function outputText(job) {
  const o = job.output || {};
  switch (job.tool) {
    case 'prompt':
      return o.prompt || '';
    case 'metadata':
      return [o.title, (o.keywords || []).join(', '), o.description].filter(Boolean).join('\n\n');
    case 'deep':
      return [o.summary, ...(o.components || []).map((c) => `${c.name}: ${c.detail}`)].filter(Boolean).join('\n');
    case 'ip-risk':
      return [`Risk: ${o.risk || 'unknown'}`, o.summary, ...(o.findings || [])].filter(Boolean).join('\n');
    default:
      return JSON.stringify(o, null, 2);
  }
}

function JobDetail({ job, onClose, onChanged }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const regen = useMutation({
    mutationFn: () => jobs.regenerate(job.id),
    onSuccess: (d) => {
      toast.success('Regeneration started.');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: () => jobs.remove(job.id),
    onSuccess: () => {
      toast.success('Job deleted.');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const thumb = job.input?.uploadUrl;
  const text = outputText(job);

  return (
    <Modal title="Job details" onClose={onClose} wide>
      <div className="stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <StatusBadge status={job.status} />
          <span className="tiny text-faint mono">{job.id}</span>
          <span className="tiny text-faint">{fmtDate(job.createdAt)}</span>
        </div>
        {thumb && (
          <img src={thumb} alt="Job input" style={{ maxHeight: 220, borderRadius: 12, alignSelf: 'flex-start' }} />
        )}
        <dl>
          <div className="kv"><dt>Tool</dt><dd>{job.tool}</dd></div>
          <div className="kv"><dt>Credits used</dt><dd>{job.creditsUsed ?? 0}</dd></div>
          {job.model && <div className="kv"><dt>Model</dt><dd className="mono">{job.model}</dd></div>}
          {job.provider && <div className="kv"><dt>Provider</dt><dd>{job.provider}</dd></div>}
          {job.durationMs != null && <div className="kv"><dt>Duration</dt><dd>{(job.durationMs / 1000).toFixed(1)}s</dd></div>}
        </dl>
        {job.status === 'failed' && (
          <div className="warn-box" role="alert">{job.error?.message || job.error || 'Job failed.'}</div>
        )}
        {text && (
          <div>
            <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>Output</h4>
            <div className="result-box">{text}</div>
          </div>
        )}
        <div className="toolbar">
          <CopyButton text={text} label="Copy output" size="sm" />
          <Button variant="secondary" size="sm" onClick={() => regen.mutate()} disabled={regen.isPending}>
            {regen.isPending ? 'Starting…' : 'Regenerate'}
          </Button>
          {confirming ? (
            <>
              <span className="small text-muted">Delete this job?</span>
              <Button variant="danger" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>Yes, delete</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
            </>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>Delete</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function History() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [tool, setTool] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [detailId, setDetailId] = useState(params.get('job'));

  const listQ = useQuery({
    queryKey: ['jobs', tool, status, page],
    queryFn: () => jobs.list({ tool: tool || undefined, status: status || undefined, page, limit: 20 }),
    retry: 1,
  });

  const detailQ = useQuery({
    queryKey: ['job', detailId],
    queryFn: () => jobs.get(detailId),
    enabled: !!detailId,
    retry: 1,
  });

  useEffect(() => {
    const j = params.get('job');
    if (j) setDetailId(j);
  }, [params]);

  const list = listQ.data?.jobs || [];
  const pagination = listQ.data?.pagination || { pages: 1 };
  const allSelected = list.length > 0 && list.every((j) => selected.includes(j.id));

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleAll = () =>
    setSelected(allSelected ? [] : list.map((j) => j.id));

  const exportSelected = async () => {
    if (!selected.length) return toast.warn('Select at least one job to export.');
    try {
      await jobs.exportManyCsv(selected);
      toast.success('CSV downloaded.');
    } catch (e) {
      toast.error(errMsg(e, 'Export failed.'));
    }
  };

  const clearAll = useMutation({
    mutationFn: () => jobs.clear(tool || undefined),
    onSuccess: (d) => {
      toast.success(d.deleted ? `Deleted ${d.deleted} job${d.deleted === 1 ? '' : 's'}.` : 'History cleared.');
      setSelected([]);
      setConfirmClear(false);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const closeDetail = () => {
    setDetailId(null);
    setParams((p) => { p.delete('job'); return p; }, { replace: true });
  };

  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem' }}>History</h2>
          <p className="text-muted">Every generation you've run, in one place.</p>
        </div>
        <div className="toolbar">
          <Button variant="secondary" size="sm" onClick={exportSelected} disabled={!selected.length}>
            Export CSV{selected.length ? ` (${selected.length})` : ''}
          </Button>
          {confirmClear ? (
            <>
              <span className="small text-muted">Clear{tool ? ' filtered' : ' all'} history?</span>
              <Button variant="danger" size="sm" onClick={() => clearAll.mutate()} disabled={clearAll.isPending}>
                {clearAll.isPending ? 'Clearing…' : 'Yes, clear'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>Cancel</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>Clear all</Button>
          )}
        </div>
      </div>

      <Card>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180 }}>
            <Field label="Tool">
              <Select
                value={tool}
                onChange={(e) => { setTool(e.target.value); setPage(1); setSelected([]); }}
                aria-label="Filter by tool"
              >
                {TOOLS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ minWidth: 180 }}>
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); setSelected([]); }}
                aria-label="Filter by status"
              >
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        {listQ.isLoading && <SkeletonCard />}
        {listQ.isError && <div className="warn-box" role="alert">{errMsg(listQ.error, 'Could not load history.')}</div>}

        {listQ.data && list.length === 0 && (
          <EmptyState
            icon="🕘"
            title="No history yet"
            body="Run a generation in Prompt Studio, Stock Metadata, or Analysis Lab and it will show up here."
          />
        )}

        {list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all jobs on this page"
                    />
                  </th>
                  <th>Tool</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Credits</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(j.id)}
                        onChange={() => toggleSelect(j.id)}
                        aria-label={`Select job ${j.id}`}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{j.tool}</td>
                    <td><StatusBadge status={j.status} /></td>
                    <td className="small text-muted">{fmtDate(j.createdAt)}</td>
                    <td className="mono small">{j.creditsUsed ?? 0}</td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(j.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination page={page} pages={pagination.pages} onPage={(p) => { setPage(p); setSelected([]); }} />

      {detailId && detailQ.data?.job && (
        <JobDetail job={detailQ.data.job} onClose={closeDetail} onChanged={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })} />
      )}
      {detailId && detailQ.isError && (
        <Modal title="Job details" onClose={closeDetail}>
          <div className="warn-box" role="alert">{errMsg(detailQ.error, 'Could not load this job.')}</div>
        </Modal>
      )}
    </div>
  );
}
