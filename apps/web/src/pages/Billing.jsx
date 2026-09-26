import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { billing, credits, errMsg } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

function money(p) {
  if (p.price == null) return 'Free';
  return `${p.price} ${p.currency || ''}`.trim();
}

export default function Billing() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const meQ = useQuery({ queryKey: ['billing-me'], queryFn: billing.me, retry: 1 });
  const plansQ = useQuery({ queryKey: ['billing-plans'], queryFn: billing.plans, retry: 1 });
  const creditsQ = useQuery({ queryKey: ['credits'], queryFn: credits.balance, retry: 1 });
  const ledgerQ = useQuery({
    queryKey: ['ledger', page],
    queryFn: () => credits.ledger({ page, limit: 20 }),
    retry: 1,
  });

  const checkout = useMutation({
    mutationFn: (planId) => billing.checkout(planId),
    onSuccess: (d) => {
      if (d.url) window.location.href = d.url;
    },
    onError: (e) => {
      if (e?.response?.status === 501) {
        toast.warn(errMsg(e, 'Checkout is not configured yet.'));
      } else toast.error(errMsg(e));
    },
  });

  const me = meQ.data;
  const plans = plansQ.data?.plans || [];
  const bal = creditsQ.data;
  const ledger = ledgerQ.data?.data || [];
  const ledgerPages = ledgerQ.data?.pagination?.pages || 1;

  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Billing</h2>
        <p className="text-muted">Plans, credits, and where they went.</p>
      </div>

      <div className="two-col">
        <Card>
          <CardHeader title="Current plan" />
          {meQ.isLoading ? (
            <SkeletonCard />
          ) : meQ.isError ? (
            <div className="warn-box" role="alert">{errMsg(meQ.error, 'Could not load your plan.')}</div>
          ) : (
            <div className="stack">
              <div className="row">
                <Badge variant="accent">{me?.plan || 'free'}</Badge>
              </div>
              <dl>
                <div className="kv"><dt>Credit balance</dt><dd>{bal?.balance ?? me?.credits ?? '—'}</dd></div>
                <div className="kv"><dt>Daily free remaining</dt><dd>{bal?.dailyFreeRemaining ?? '—'}</dd></div>
                <div className="kv"><dt>Resets at</dt><dd className="small">{bal?.resetsAt ? new Date(bal.resetsAt).toLocaleString() : '—'}</dd></div>
              </dl>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Need more credits?" sub="Two ways to keep generating." />
          <ul style={{ paddingLeft: '1.25rem', margin: '0 0 1rem' }} className="small text-muted">
            <li>Upgrade to a plan below for a monthly credit allowance.</li>
            <li>Or bring your own provider key in Settings → AI Providers — BYOK generations cost nothing.</li>
          </ul>
        </Card>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem' }}>Plans</h3>
        {plansQ.isLoading && (
          <div className="grid grid-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        )}
        {plansQ.isError && <div className="warn-box" role="alert">{errMsg(plansQ.error, 'Could not load plans.')}</div>}
        {plansQ.data && plans.length === 0 && (
          <EmptyState icon="◌" title="No plans listed" body="Check back soon — free daily credits still work." />
        )}
        <div className="grid grid-3">
          {plans.map((p) => {
            const current = me?.plan === p.id;
            return (
              <Card key={p.id} className={`pricing-card${current ? ' popular' : ''}`}>
                <h3>{p.name}</h3>
                <div className="pricing-price">{money(p)}{p.interval ? <span className="small text-muted">/{p.interval}</span> : null}</div>
                <ul className="pricing-features">
                  {(p.features || []).map((f, i) => <li key={i}>{f}</li>)}
                  {p.creditsPerMonth != null && <li>{p.creditsPerMonth} credits / month</li>}
                  {p.creditsPerDay != null && <li>{p.creditsPerDay} free credits / day</li>}
                </ul>
                {current ? (
                  <Button variant="secondary" block disabled>Current plan</Button>
                ) : (
                  <Button
                    block
                    disabled={checkout.isPending || !p.price}
                    onClick={() => (p.price ? checkout.mutate(p.id) : toast.info('You are already on the free plan.'))}
                  >
                    {checkout.isPending ? '…' : p.price ? 'Upgrade' : 'Free forever'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem' }}>Credit ledger</h3>
        <Card>
          {ledgerQ.isLoading && <SkeletonCard />}
          {ledgerQ.isError && <div className="warn-box" role="alert">{errMsg(ledgerQ.error, 'Could not load the ledger.')}</div>}
          {ledgerQ.data && ledger.length === 0 && (
            <EmptyState icon="◌" title="No credit activity yet" body="Credits you earn or spend will appear here." />
          )}
          {ledger.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Change</th><th>Reason</th><th>Job</th></tr>
                </thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="small text-muted">{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</td>
                      <td className="mono" style={{ color: l.delta >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                        {l.delta >= 0 ? '+' : ''}{l.delta}
                      </td>
                      <td className="small">{l.reason}</td>
                      <td className="tiny mono text-faint">{l.jobId || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Pagination page={page} pages={ledgerPages} onPage={setPage} />
      </div>
    </div>
  );
}

