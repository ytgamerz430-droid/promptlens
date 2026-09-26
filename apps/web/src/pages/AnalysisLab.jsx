import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { jobs, errMsg, errCode } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import { Toggle } from '../components/Input.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import JobProgress from '../components/JobProgress.jsx';
import CopyButton from '../components/CopyButton.jsx';
import Badge, { RiskBadge } from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';

function DeepResult({ job }) {
  const out = job?.output || {};
  const components = out.components || [];
  return (
    <Card>
      <CardHeader
        title="Deep analysis"
        sub={job.durationMs != null ? `generated in ${(job.durationMs / 1000).toFixed(1)}s` : undefined}
        action={job.provider === 'mock' ? <Badge variant="accent">Demo mode</Badge> : null}
      />
      {out.summary && <p>{out.summary}</p>}
      <div className="grid grid-2">
        {components.map((c, i) => (
          <div key={i} className="card" style={{ padding: '1rem' }}>
            <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>{c.name}</h4>
            <p className="small text-muted" style={{ margin: 0 }}>{c.detail}</p>
          </div>
        ))}
      </div>
      {!components.length && !out.summary && <p className="text-faint">No components returned.</p>}
      <div className="toolbar" style={{ marginTop: '1rem' }}>
        <CopyButton text={JSON.stringify(out, null, 2)} label="Copy JSON" size="sm" />
      </div>
    </Card>
  );
}

function IpRiskResult({ job }) {
  const out = job?.output || {};
  const findings = out.findings || [];
  return (
    <Card>
      <CardHeader
        title="IP risk check"
        sub={job.durationMs != null ? `generated in ${(job.durationMs / 1000).toFixed(1)}s` : undefined}
        action={<RiskBadge risk={out.risk || 'low'} />}
      />
      {out.summary && <p>{out.summary}</p>}
      {findings.length ? (
        <ul style={{ paddingLeft: '1.25rem', margin: '0 0 1rem' }}>
          {findings.map((f, i) => (
            <li key={i} className="small" style={{ marginBottom: '0.4rem' }}>{f}</li>
          ))}
        </ul>
      ) : (
        <p className="text-faint small">No specific findings — nothing recognizable flagged.</p>
      )}
      <p className="tiny text-faint">
        This is an automated first pass, not legal advice. When in doubt, check with a professional.
      </p>
    </Card>
  );
}

function ToolPane({ tool, title, sub, result: ResultView }) {
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState(null);
  const [byok, setByok] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [result, setResult] = useState(null);

  const start = useMutation({
    mutationFn: (input) =>
      jobs.create(tool, input, `web-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    onSuccess: (d) => {
      setResult(null);
      setJobId(d.job.id);
    },
    onError: (e) => {
      if (errCode(e) === 'INSUFFICIENT_CREDITS') {
        toast.error('Not enough credits. Top up in Billing or enable BYOK with your own key.');
      } else toast.error(errMsg(e));
    },
  });

  const handleDone = useCallback(
    (job) => {
      if (job.status === 'completed') {
        setResult(job);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['credits'] });
      } else if (job.status === 'failed') {
        toast.error(job.error?.message || 'Analysis failed.');
      }
    },
    [queryClient]
  );

  return (
    <div className="two-col">
      <Card>
        <CardHeader title="Image" sub={sub} />
        <UploadDropzone onUploaded={setUpload} />
        <Toggle label="Use my own key (BYOK)" sub="Spends no credits; uses the provider key from Settings." checked={byok} onChange={setByok} />
        <Button
          block
          style={{ marginTop: '1.25rem' }}
          disabled={start.isPending || !upload}
          onClick={() => {
            if (!upload) return toast.warn('Upload an image first.');
            start.mutate({ uploadId: upload.id, uploadUrl: upload.url, byok });
          }}
        >
          {start.isPending ? 'Starting…' : 'Analyze'}
        </Button>
      </Card>
      <div className="stack">
        {jobId && !result && <JobProgress jobId={jobId} onDone={handleDone} onError={(m) => toast.error(m)} />}
        {result && <ResultView job={result} />}
        {!jobId && !result && (
          <EmptyState icon="◍" title={`No ${title.toLowerCase()} yet`} body="Upload a photo to get started." />
        )}
      </div>
    </div>
  );
}

export default function AnalysisLab() {
  const [tab, setTab] = useState('deep');
  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Analysis Lab</h2>
        <p className="text-muted">Look closer at your images — composition, or legal risk.</p>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'deep'} className={`tab${tab === 'deep' ? ' active' : ''}`} onClick={() => setTab('deep')}>
          Deep Analysis
        </button>
        <button role="tab" aria-selected={tab === 'ip-risk'} className={`tab${tab === 'ip-risk' ? ' active' : ''}`} onClick={() => setTab('ip-risk')}>
          IP Risk
        </button>
      </div>
      {tab === 'deep' ? (
        <ToolPane tool="deep" title="Deep analysis" sub="A structured breakdown of what's in the frame." result={DeepResult} />
      ) : (
        <ToolPane tool="ip-risk" title="IP risk check" sub="Flags logos, trademarks, and recognizable IP." result={IpRiskResult} />
      )}
    </div>
  );
}
