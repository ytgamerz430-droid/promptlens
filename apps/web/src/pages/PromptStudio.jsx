import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { jobs, batches, errMsg, errCode } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import { Select, Field, Toggle } from '../components/Input.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import JobProgress from '../components/JobProgress.jsx';
import CopyButton from '../components/CopyButton.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

const STYLES = [
  { id: 'art_prompt', label: 'Art prompt (default)' },
  { id: 'photoreal', label: 'Photorealistic' },
  { id: 'minimal', label: 'Minimal / clean' },
  { id: 'detailed', label: 'Highly detailed' },
];

function seconds(ms) {
  if (ms == null) return null;
  return (ms / 1000).toFixed(1);
}

function ResultCard({ job, onRegenerate, regenerating }) {
  const prompt = job?.output?.prompt;
  if (!prompt) return null;
  return (
    <Card>
      <CardHeader
        title="Your prompt"
        sub={
          <>
            {job.durationMs != null && `generated in ${seconds(job.durationMs)}s`}
            {job.model && ` · ${job.model}`}
            {job.provider && ` via ${job.provider}`}
          </>
        }
        action={job.provider === 'mock' ? <Badge variant="accent">Demo mode</Badge> : null}
      />
      <div className="result-box" style={{ marginBottom: '1rem' }}>{prompt}</div>
      <div className="toolbar">
        <CopyButton text={prompt} label="Copy" />
        <Button variant="secondary" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </Button>
      </div>
    </Card>
  );
}

function SingleTab({ resumeJobId, onJobCreated }) {
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState(null);
  const [style, setStyle] = useState('art_prompt');
  const [ipSafe, setIpSafe] = useState(false);
  const [iconMode, setIconMode] = useState(false);
  const [byok, setByok] = useState(false);
  const [jobId, setJobId] = useState(resumeJobId || null);
  const [result, setResult] = useState(null);

  const start = useMutation({
    mutationFn: (input) =>
      jobs.create('prompt', input, `web-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    onSuccess: (d) => {
      setResult(null);
      setJobId(d.job.id);
      onJobCreated(d.job.id);
    },
    onError: (e) => {
      if (errCode(e) === 'INSUFFICIENT_CREDITS') {
        toast.error('Not enough credits. Top up in Billing or enable BYOK with your own key.');
      } else {
        toast.error(errMsg(e));
      }
    },
  });

  const regen = useMutation({
    mutationFn: () => jobs.regenerate(jobId),
    onSuccess: (d) => {
      setResult(null);
      setJobId(d.job.id);
      onJobCreated(d.job.id);
      toast.info('Regenerating with the same settings…');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const handleDone = useCallback(
    (job) => {
      if (job.status === 'completed') {
        setResult(job);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['credits'] });
      } else if (job.status === 'failed') {
        toast.error(job.error?.message || 'Generation failed.');
      }
    },
    [queryClient]
  );

  const generate = () => {
    if (!upload) {
      toast.warn('Upload an image first.');
      return;
    }
    start.mutate({
      uploadId: upload.id,
      uploadUrl: upload.url,
      outputStyle: style,
      ipSafe,
      iconMode,
      byok,
    });
  };

  const busy = start.isPending || !!jobId && !result;

  return (
    <div className="two-col">
      <Card>
        <CardHeader title="Image" sub="The photo you want described." />
        <UploadDropzone onUploaded={setUpload} />
        {upload && (
          <p className="small text-muted" style={{ marginTop: '0.5rem' }}>
            Uploaded: <span className="mono">{upload.id}</span> ({Math.round(upload.size / 1024)} KB)
          </p>
        )}
        <div style={{ marginTop: '1rem' }}>
          <Field label="Output style">
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Toggle label="IP-safe wording" sub="Avoids brand names and trademarked terms." checked={ipSafe} onChange={setIpSafe} />
          <Toggle label="Icon mode" sub="Short, symbolic descriptions for icon-style art." checked={iconMode} onChange={setIconMode} />
          <Toggle label="Use my own key (BYOK)" sub="Spends no credits; uses the provider key from Settings." checked={byok} onChange={setByok} />
        </div>
        <Button block onClick={generate} disabled={start.isPending || !upload} style={{ marginTop: '1.25rem' }}>
          {start.isPending ? 'Starting…' : 'Generate'}
        </Button>
      </Card>

      <div className="stack">
        {jobId && !result && <JobProgress jobId={jobId} onDone={handleDone} onError={(m) => toast.error(m)} />}
        {result && (
          <ResultCard job={result} onRegenerate={() => regen.mutate()} regenerating={regen.isPending} />
        )}
        {!jobId && !result && (
          <EmptyState icon="✦" title="No prompt yet" body="Upload a photo and hit Generate — your prompt will appear here." />
        )}
      </div>
    </div>
  );
}

const BATCH_LABEL = { queued: 'Queued', processing: 'Generating', completed: 'Success', failed: 'Failed' };
const BATCH_VARIANT = { queued: 'neutral', processing: 'info', completed: 'success', failed: 'danger' };

function BatchTab() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState([]); // uploaded files
  const [byok, setByok] = useState(false);
  const [batchId, setBatchId] = useState(null);
  const [style, setStyle] = useState('art_prompt');

  const create = useMutation({
    mutationFn: () =>
      batches.create('prompt', items.map((u) => ({ uploadId: u.id, uploadUrl: u.url })), { outputStyle: style, byok }),
    onSuccess: (d) => {
      setBatchId(d.batch.id);
      toast.info(`Batch started — ${d.batch.total} images.`);
    },
    onError: (e) => {
      if (errCode(e) === 'INSUFFICIENT_CREDITS') {
        toast.error('Not enough credits for the whole batch. Top up in Billing or use BYOK.');
      } else toast.error(errMsg(e));
    },
  });

  const batchQ = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => batches.get(batchId),
    enabled: !!batchId,
    refetchInterval: (q) => {
      const b = q.state.data?.batch;
      return b && (b.queued > 0 || b.processing > 0) ? 2000 : false;
    },
  });

  useEffect(() => {
    const b = batchQ.data?.batch;
    if (b && b.queued === 0 && b.processing === 0) {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    }
  }, [batchQ.data, queryClient]);

  const batch = batchQ.data?.batch;
  const done = batch ? batch.completed + batch.failed : 0;
  const pct = batch && batch.total ? Math.round((done / batch.total) * 100) : 0;

  const startOver = () => {
    setBatchId(null);
    setItems([]);
  };

  return (
    <div className="two-col">
      <Card>
        <CardHeader title="Batch images" sub="Upload several photos; each becomes its own job." />
        <UploadDropzone multiple onUploaded={(u) => setItems((p) => [...p, u])} />
        {items.length > 0 && (
          <div className="chip-wrap" style={{ marginTop: '0.75rem' }}>
            {items.map((u) => (
              <span key={u.id} className="chip" title={u.id}>
                {u.id.slice(0, 12)}…
              </span>
            ))}
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <Field label="Output style">
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Toggle label="Use my own key (BYOK)" sub="Spends no credits; uses the provider key from Settings." checked={byok} onChange={setByok} />
        </div>
        <div className="toolbar" style={{ marginTop: '1.25rem' }}>
          <Button onClick={() => create.mutate()} disabled={create.isPending || items.length === 0 || !!batchId}>
            {create.isPending ? 'Starting…' : `Generate ${items.length || ''} prompts`.trim()}
          </Button>
          {batchId && <Button variant="ghost" onClick={startOver}>Start over</Button>}
        </div>
      </Card>

      <div className="stack">
        {!batchId && !batchQ.isLoading && (
          <EmptyState icon="▦" title="No batch running" body="Add images on the left, then generate them all at once." />
        )}
        {batchQ.isLoading && <SkeletonCard />}
        {batch && (
          <Card>
            <CardHeader title="Batch progress" sub={`${done} of ${batch.total} finished`} />
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <Badge variant="neutral">{batch.queued} queued</Badge>
              <Badge variant="info">{batch.processing} generating</Badge>
              <Badge variant="success">{batch.completed} success</Badge>
              <Badge variant="danger">{batch.failed} failed</Badge>
            </div>
            <div className="stack" style={{ marginTop: '1rem' }}>
              {batch.jobs.map((j) => (
                <div key={j.id} className="row-between">
                  <span className="mono tiny">{j.id}</span>
                  <Badge variant={BATCH_VARIANT[j.status] || 'neutral'}>
                    {BATCH_LABEL[j.status] || j.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function PromptStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'batch' ? 'batch' : 'single';
  const resumeJobId = params.get('job');

  const setTab = (t) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });
  const setJobParam = useCallback(
    (id) => setParams((p) => { if (id) p.set('job', id); else p.delete('job'); return p; }, { replace: true }),
    [setParams]
  );

  const initialJob = useMemo(() => resumeJobId, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Prompt Studio</h2>
        <p className="text-muted">Turn a photo into a ready-to-use AI image prompt.</p>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'single'} className={`tab${tab === 'single' ? ' active' : ''}`} onClick={() => setTab('single')}>
          Single
        </button>
        <button role="tab" aria-selected={tab === 'batch'} className={`tab${tab === 'batch' ? ' active' : ''}`} onClick={() => setTab('batch')}>
          Batch
        </button>
      </div>
      {tab === 'single' ? (
        <SingleTab resumeJobId={initialJob} onJobCreated={setJobParam} />
      ) : (
        <BatchTab />
      )}
    </div>
  );
}
