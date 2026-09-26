import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { referral, errMsg } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Input, { Field } from '../components/Input.jsx';
import CopyButton from '../components/CopyButton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

export default function Referral() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [page, setPage] = useState(1);

  const meQ = useQuery({ queryKey: ['referral-me'], queryFn: referral.me, retry: 1 });
  const histQ = useQuery({
    queryKey: ['redeem-history', page],
    queryFn: () => referral.redeemHistory({ page, limit: 20 }),
    retry: 1,
  });

  const redeem = useMutation({
    mutationFn: () => referral.redeem(code.trim()),
    onSuccess: (d) => {
      toast.success(d.creditsAdded ? `Redeemed — ${d.creditsAdded} credits added.` : 'Code redeemed.');
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['redeem-history'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
    onError: (e) => toast.error(errMsg(e, 'That code didn’t work. Check it and try again.')),
  });

  const me = meQ.data;
  const hist = histQ.data?.data || [];
  const histPages = histQ.data?.pagination?.pages || 1;

  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Referral</h2>
        <p className="text-muted">Invite friends, earn credits. Have a code? Redeem it below.</p>
      </div>

      <div className="two-col">
        <Card>
          <CardHeader title="Your referral link" sub="Friends who sign up with it earn you both credits." />
          {meQ.isLoading ? (
            <SkeletonCard />
          ) : meQ.isError ? (
            <div className="warn-box" role="alert">{errMsg(meQ.error, 'Could not load your referral info.')}</div>
          ) : (
            <div className="stack">
              <div className="result-box mono small">{me?.url || '—'}</div>
              <div className="toolbar">
                <CopyButton text={me?.url || ''} label="Copy link" />
              </div>
              <dl>
                <div className="kv"><dt>Your code</dt><dd className="mono">{me?.code || '—'}</dd></div>
                <div className="kv"><dt>Friends joined</dt><dd>{me?.referredCount ?? 0}</dd></div>
                <div className="kv"><dt>Credits earned</dt><dd>{me?.earnedCredits ?? 0}</dd></div>
              </dl>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Redeem a code" sub="Got a referral or gift code? Cash it in." />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) return toast.warn('Enter a code first.');
              redeem.mutate();
            }}
          >
            <Field label="Code" htmlFor="redeem-code">
              <Input
                id="redeem-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                autoComplete="off"
              />
            </Field>
            <Button type="submit" disabled={redeem.isPending}>
              {redeem.isPending ? 'Redeeming…' : 'Redeem'}
            </Button>
          </form>
        </Card>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem' }}>Redeem history</h3>
        <Card>
          {histQ.isLoading && <SkeletonCard />}
          {histQ.isError && <div className="warn-box" role="alert">{errMsg(histQ.error, 'Could not load redeem history.')}</div>}
          {histQ.data && hist.length === 0 && (
            <EmptyState icon="◌" title="No redemptions yet" body="Codes you redeem will be listed here." />
          )}
          {hist.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Code</th><th>Credits</th></tr>
                </thead>
                <tbody>
                  {hist.map((h) => (
                    <tr key={h.id}>
                      <td className="small text-muted">{h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}</td>
                      <td className="mono small">{h.code || '—'}</td>
                      <td className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>+{h.creditsAdded ?? h.delta ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Pagination page={page} pages={histPages} onPage={setPage} />
      </div>
    </div>
  );
}
