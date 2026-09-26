import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { jobs, platforms, errMsg, errCode } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Input, { Select, Field, Textarea, Toggle } from '../components/Input.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import JobProgress from '../components/JobProgress.jsx';
import CopyButton from '../components/CopyButton.jsx';
import Chip from '../components/Chip.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

function ResultView({ job, onRegenerate, regenerating }) {
  const out = job?.output || {};
  const title = out.title || '';
  const keywords = out.keywords || [];
  const platform = job?.input?.platform;

  const [limits, setLimits] = useState(null);
  const platQ = useQuery({ queryKey: ['platforms'], queryFn: platforms.list, retry: 1 });
  useEffect(() => {
    const p = platQ.data?.platforms?.find((x) => x.id === platform);
    if (p) setLimits(p);
  }, [platQ.data, platform]);

  const warnings = [];
  if (limits) {
    if (limits.titleMin && title.length < limits.titleMin)
      warnings.push(`Title is ${title.length} chars — ${limits.titleMin} minimum for this marketplace.`);
    if (limits.titleMax && title.length > limits.titleMax)
      warnings.push(`Title is ${title.length} chars — ${limits.titleMax} maximum for this marketplace.`);
    if (limits.keywordMin && keywords.length < limits.keywordMin)
      warnings.push(`Only ${keywords.length} keywords — ${limits.keywordMin} minimum recommended.`);
    if (limits.keywordMax && keywords.length > limits.keywordMax)
      warnings.push(`${keywords.length} keywords — ${limits.keywordMax} maximum for this marketplace.`);
  }

  const copyAll = async () => {
    const text = [title, keywords.join(', '), out.description].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Title, keywords, and description copied.');
    } catch {
      toast.error('Copy failed — select the text manually.');
    }
  };

  const exportCsv = async () => {
    try {
      await jobs.exportCsv(job.id);
      toast.success('CSV downloaded.');
    } catch (e) {
      toast.error(errMsg(e, 'Export failed.'));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Metadata result"
        sub={
          <>
            {job.durationMs != null && `generated in ${(job.durationMs / 1000).toFixed(1)}s`}
            {job.model && ` · ${job.model}`}
            {job.provider && ` via ${job.provider}`}
          </>
        }
        action={job.provider === 'mock' ? <Badge variant="accent">Demo mode</Badge> : null}
      />
      {warnings.length > 0 && (
        <div className="stack" style={{ marginBottom: '1rem' }}>
          {warnings.map((w, i) => (
            <div key={i} className="warn-box" role="alert">{w}</div>
          ))}
        </div>
      )}
      <Field label={`Title (${title.length}${limits?.titleMax ? ` / max ${limits.titleMax}` : ''} chars)`}>
        <div className="result-box">{title || <span className="text-faint">—</span>}</div>
      </Field>
      <Field label={`Keywords (${keywords.length}) — click a chip to copy it`}>
        {keywords.length ? (
          <div className="chip-wrap">{keywords.map((k, i) => <Chip key={i} text={k} />)}</div>
        ) : (
          <span className="text-faint small">No keywords returned.</span>
        )}
      </Field>
      {out.description && (
        <Field label="Description">
          <div className="result-box">{out.description}</div>
        </Field>
      )}
      <div className="toolbar">
        <CopyButton text={title} label="Copy title" size="sm" />
        <Button variant="secondary" size="sm" onClick={copyAll}>Copy all</Button>
        <Button variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </Button>
      </div>
    </Card>
  );
}

export default function MetadataStudio() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const resumeJobId = useMemo(() => params.get('job'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [upload, setUpload] = useState(null);
  const [platform, setPlatform] = useState('adobe_stock');
  const [titleMin, setTitleMin] = useState('');
  const [titleMax, setTitleMax] = useState('');
  const [keywordMin, setKeywordMin] = useState('');
  const [keywordMax, setKeywordMax] = useState('');
  const [keywordType, setKeywordType] = useState('mixed');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customKeywords, setCustomKeywords] = useState('');
  const [byok, setByok] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobId, setJobId] = useState(resumeJobId || null);
  const [result, setResult] = useState(null);

  const platQ = useQuery({ queryKey: ['platforms'], queryFn: platforms.list, retry: 1 });

  // prefill limits from the selected marketplace
  useEffect(() => {
    const p = platQ.data?.platforms?.find((x) => x.id === platform);
    if (!p) return;
    setTitleMin(p.titleMin ?? '');
    setTitleMax(p.titleMax ?? '');
    setKeywordMin(p.keywordMin ?? '');
    setKeywordMax(p.keywordMax ?? '');
    setKeywordType(p.keywordType || 'mixed');
  }, [platform, platQ.data]);

  const start = useMutation({
    mutationFn: (input) =>
      jobs.create('metadata', input, `web-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    onSuccess: (d) => {
      setResult(null);
      setJobId(d.job.id);
      setParams((p) => { p.set('job', d.job.id); return p; }, { replace: true });
    },
    onError: (e) => {
      if (errCode(e) === 'INSUFFICIENT_CREDITS') {
        toast.error('Not enough credits. Top up in Billing or enable BYOK with your own key.');
      } else toast.error(errMsg(e));
    },
  });

  const regen = useMutation({
    mutationFn: () => jobs.regenerate(jobId),
    onSuccess: (d) => {
      setResult(null);
      setJobId(d.job.id);
      setParams((p) => { p.set('job', d.job.id); return p; }, { replace: true });
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

  const num = (v) => (v === '' || v == null ? undefined : Number(v));

  const generate = () => {
    if (!upload) {
      toast.warn('Upload an image first.');
      return;
    }
    start.mutate({
      uploadId: upload.id,
      uploadUrl: upload.url,
      platform,
      titleMin: num(titleMin),
      titleMax: num(titleMax),
      keywordMin: num(keywordMin),
      keywordMax: num(keywordMax),
      keywordType,
      customPrompt: customPrompt.trim() || undefined,
      customKeywords: customKeywords.trim() || undefined,
      byok,
    });
  };

  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Stock Metadata</h2>
        <p className="text-muted">Title, keywords, and description shaped to each marketplace's rules.</p>
      </div>
      <div className="two-col">
        <Card>
          <CardHeader title="Image & marketplace" />
          <UploadDropzone onUploaded={setUpload} />
          {platQ.isLoading ? (
            <div style={{ marginTop: '1rem' }}><SkeletonCard /></div>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <Field label="Marketplace">
                <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {(platQ.data?.platforms || [{ id: 'adobe_stock', name: 'Adobe Stock' }]).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdvanced((s) => !s)} aria-expanded={showAdvanced}>
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>
          {showAdvanced && (
            <div style={{ marginTop: '0.75rem' }}>
              <div className="two-col">
                <Field label="Title min chars"><Input type="number" min={0} value={titleMin} onChange={(e) => setTitleMin(e.target.value)} /></Field>
                <Field label="Title max chars"><Input type="number" min={0} value={titleMax} onChange={(e) => setTitleMax(e.target.value)} /></Field>
                <Field label="Keyword min"><Input type="number" min={0} value={keywordMin} onChange={(e) => setKeywordMin(e.target.value)} /></Field>
                <Field label="Keyword max"><Input type="number" min={0} value={keywordMax} onChange={(e) => setKeywordMax(e.target.value)} /></Field>
              </div>
              <Field label="Keyword type">
                <Select value={keywordType} onChange={(e) => setKeywordType(e.target.value)}>
                  <option value="mixed">Mixed</option>
                  <option value="single">Single words</option>
                  <option value="phrase">Phrases</option>
                </Select>
              </Field>
              <Field label="Custom instructions" hint="Extra guidance for the writer, e.g. tone or focus.">
                <Textarea rows={3} value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Emphasize the warm morning light…" />
              </Field>
              <Field label="Custom keywords" hint="Comma-separated keywords to include if relevant.">
                <Input value={customKeywords} onChange={(e) => setCustomKeywords(e.target.value)} placeholder="sunrise, calm, minimal" />
              </Field>
            </div>
          )}
          <Toggle label="Use my own key (BYOK)" sub="Spends no credits; uses the provider key from Settings." checked={byok} onChange={setByok} />
          <Button block onClick={generate} disabled={start.isPending || !upload} style={{ marginTop: '1.25rem' }}>
            {start.isPending ? 'Starting…' : 'Generate'}
          </Button>
        </Card>

        <div className="stack">
          {jobId && !result && <JobProgress jobId={jobId} onDone={handleDone} onError={(m) => toast.error(m)} />}
          {result && <ResultView job={result} onRegenerate={() => regen.mutate()} regenerating={regen.isPending} />}
          {!jobId && !result && (
            <EmptyState icon="🏷" title="No metadata yet" body="Upload a photo, pick a marketplace, and generate your title and keywords." />
          )}
        </div>
      </div>
    </div>
  );
}
