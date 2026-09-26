import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { auth, settings, platforms, errMsg } from '../api/client.js';
import { useStore } from '../store.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Input, { Field, Select, Toggle } from '../components/Input.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';
import Badge from '../components/Badge.jsx';

const PROVIDER_META = {
  gemini: { label: 'Gemini', note: 'Google’s Gemini family — good vision support.' },
  groq: { label: 'Groq', note: 'Fast inference for open vision models.' },
  mistral: { label: 'Mistral', note: 'Pixtral vision models.' },
  openai: { label: 'OpenAI', note: 'GPT vision models.' },
};

function ProfileTab() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const [name, setName] = useState(user?.name || '');
  const [nameErr, setNameErr] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwErr, setPwErr] = useState('');

  const saveName = useMutation({
    mutationFn: () => auth.updateMe(name.trim()),
    onSuccess: (d) => {
      setUser(d.user);
      toast.success('Name updated.');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const changePw = useMutation({
    mutationFn: () => auth.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      toast.success('Password changed.');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="two-col">
      <Card>
        <CardHeader title="Profile" sub="How we address you." />
        <Field label="Name" error={nameErr} htmlFor="set-name">
          <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} error={nameErr} />
        </Field>
        <Field label="Email">
          <Input value={user?.email || ''} disabled aria-label="Email (read-only)" />
        </Field>
        <Button
          onClick={() => {
            if (name.trim().length < 2) return setNameErr('Enter your name.');
            setNameErr('');
            saveName.mutate();
          }}
          disabled={saveName.isPending}
        >
          {saveName.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </Card>
      <Card>
        <CardHeader title="Password" sub="Pick something long and unique." />
        <Field label="Current password" htmlFor="set-cur">
          <Input id="set-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" error={pwErr} hint="At least 8 characters." htmlFor="set-new">
          <Input id="set-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={pwErr} />
        </Field>
        <Button
          onClick={() => {
            if (!current) return setPwErr('Enter your current password.');
            if (next.length < 8) return setPwErr('Use at least 8 characters.');
            setPwErr('');
            changePw.mutate();
          }}
          disabled={changePw.isPending}
        >
          {changePw.isPending ? 'Updating…' : 'Change password'}
        </Button>
      </Card>
    </div>
  );
}

function ProviderCard({ name, info, onTested }) {
  const [key, setKey] = useState('');
  const [model, setModel] = useState(info?.model || '');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setModel(info?.model || '');
    setKey('');
    setTestResult(null);
  }, [info?.model, info?.masked, name]);

  const save = async () => {
    setSaving(true);
    try {
      // empty-string apiKey clears the key (per contract)
      const d = await settings.update({ providers: { [name]: { apiKey: key, ...(model ? { model } : {}) } } });
      setKey('');
      onTested(d.settings);
      toast.success(`${PROVIDER_META[name].label} settings saved.`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const d = await settings.testProvider(name);
      setTestResult(d);
      if (d.ok) toast.success(`Connected to ${d.model} in ${d.latencyMs}ms.`);
      else toast.error(d.error || 'Connection failed.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <div className="row-between" style={{ marginBottom: '0.5rem' }}>
        <h3 className="card-title" style={{ margin: 0 }}>{PROVIDER_META[name].label}</h3>
        {info?.configured ? <Badge variant="success">Configured</Badge> : <Badge variant="neutral">Not set</Badge>}
      </div>
      <p className="small text-muted">{PROVIDER_META[name].note}</p>
      {info?.masked && (
        <p className="small">
          Saved key: <span className="mono">{info.masked}</span>
        </p>
      )}
      <Field label="API key" hint="Leave blank and save to clear the key. Keys are stored encrypted and never shown in full.">
        <div className="row">
          <Input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={info?.configured ? 'Enter a new key to replace' : 'Paste your API key'}
            autoComplete="off"
          />
          <Button variant="ghost" size="sm" onClick={() => setShowKey((s) => !s)}>
            {showKey ? 'Hide' : 'Show'}
          </Button>
        </div>
      </Field>
      <Field label="Model override" hint="Defaults shown; change only if you know what you're doing.">
        <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={info?.model || ''} />
      </Field>
      {testResult && (
        <div className={testResult.ok ? 'info-box' : 'warn-box'} role="status" style={{ marginBottom: '0.75rem' }}>
          {testResult.ok
            ? `OK — ${testResult.model}, answered in ${testResult.latencyMs}ms.`
            : `Failed — ${testResult.error || 'unknown error'}`}
        </div>
      )}
      <div className="toolbar">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button variant="secondary" size="sm" onClick={test} disabled={testing || !info?.configured}>
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
      </div>
    </Card>
  );
}

function ProvidersTab() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: settings.get, retry: 1 });
  const s = q.data?.settings;

  const refresh = (next) => queryClient.setQueryData(['settings'], { settings: next });

  if (q.isLoading) return <SkeletonCard />;
  if (q.isError) return <div className="warn-box" role="alert">{errMsg(q.error, 'Could not load settings.')}</div>;

  return (
    <div className="stack">
      <div className="info-box">
        <strong>Bring your own key (BYOK).</strong> Add a key below and flip the BYOK toggle on any
        generation — it will use your provider account instead of spending platform credits.
      </div>
      <div className="grid grid-2">
        {Object.keys(PROVIDER_META).map((name) => (
          <ProviderCard key={name} name={name} info={s?.providers?.[name]} onTested={refresh} />
        ))}
      </div>
    </div>
  );
}

function DefaultsTab() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: settings.get, retry: 1 });
  const platQ = useQuery({ queryKey: ['platforms'], queryFn: platforms.list, retry: 1 });
  const s = q.data?.settings;
  const [platform, setPlatform] = useState('');
  const [provider, setProvider] = useState('');

  useEffect(() => {
    if (s) {
      setPlatform(s.defaultPlatform || 'adobe_stock');
      setProvider(s.defaultProvider || 'gemini');
    }
  }, [s]);

  const save = useMutation({
    mutationFn: () => settings.update({ defaultPlatform: platform, defaultProvider: provider }),
    onSuccess: (d) => {
      queryClient.setQueryData(['settings'], d);
      toast.success('Defaults saved.');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <SkeletonCard />;
  if (q.isError) return <div className="warn-box" role="alert">{errMsg(q.error, 'Could not load settings.')}</div>;

  return (
    <Card>
      <CardHeader title="Defaults" sub="Pre-selected on every new generation." />
      <Field label="Default marketplace">
        <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {(platQ.data?.platforms || []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Default provider">
        <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {Object.keys(PROVIDER_META).map((n) => (
            <option key={n} value={n}>{PROVIDER_META[n].label}</option>
          ))}
        </Select>
      </Field>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save defaults'}
      </Button>
    </Card>
  );
}

function AppearanceTab() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  return (
    <Card>
      <CardHeader title="Appearance" sub="The app follows your choice immediately." />
      <Toggle
        label="Dark theme"
        sub={theme === 'dark' ? 'Currently on — easy on the eyes at night.' : 'Currently off — switch back anytime.'}
        checked={theme === 'dark'}
        onChange={() => toggleTheme()}
      />
    </Card>
  );
}

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'providers', label: 'AI Providers' },
  { id: 'defaults', label: 'Defaults' },
  { id: 'appearance', label: 'Appearance' },
];

export default function Settings() {
  const [tab, setTab] = useState('profile');
  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Settings</h2>
        <p className="text-muted">Your account, keys, and preferences.</p>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'providers' && <ProvidersTab />}
      {tab === 'defaults' && <DefaultsTab />}
      {tab === 'appearance' && <AppearanceTab />}
    </div>
  );
}

