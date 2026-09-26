import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jobs, errMsg } from '../api/client.js';
import { StatusBadge } from './Badge.jsx';
import Button from './Button.jsx';

const ACTIVE = ['queued', 'processing'];

/**
 * Polls a job every 2s while queued/processing.
 * Calls onDone(job) exactly once when the job reaches a terminal state.
 */
export default function JobProgress({ jobId, onDone, onError }) {
  const firedRef = useRef(false);

  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobs.get(jobId),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.job?.status;
      return s && ACTIVE.includes(s) ? 2000 : false;
    },
    retry: 2,
  });

  const job = query.data?.job;

  useEffect(() => {
    if (job && !ACTIVE.includes(job.status) && !firedRef.current) {
      firedRef.current = true;
      onDone?.(job);
    }
  }, [job, onDone]);

  useEffect(() => {
    if (query.isError) onError?.(errMsg(query.error));
  }, [query.isError]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!jobId) return null;

  if (query.isLoading) {
    return (
      <div className="card">
        <div className="row"><div className="spinner" aria-hidden="true" /><span>Starting…</span></div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="card">
        <div className="warn-box" role="alert">{errMsg(query.error, 'Could not load job status.')}</div>
      </div>
    );
  }

  const pct = job?.progress ?? (job?.status === 'queued' ? 5 : 0);

  return (
    <div className="card" aria-live="polite">
      <div className="row-between" style={{ marginBottom: '0.75rem' }}>
        <StatusBadge status={job.status} />
        <span className="tiny text-faint mono">{job.id}</span>
      </div>
      {ACTIVE.includes(job.status) ? (
        <>
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            <div className="spinner" aria-hidden="true" />
            <span>{job.status === 'queued' ? 'Queued — waiting for a worker…' : 'Analyzing your image…'}</span>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : job.status === 'failed' ? (
        <div className="warn-box" role="alert">
          {job.error?.message || job.error || 'Generation failed.'}{' '}
          <Button variant="ghost" size="sm" onClick={() => query.refetch()}>Retry status</Button>
        </div>
      ) : null}
    </div>
  );
}
