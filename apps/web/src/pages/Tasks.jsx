import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { tasks, errMsg } from '../api/client.js';
import Card, { CardHeader } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

export default function Tasks() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['tasks'], queryFn: tasks.list, retry: 1 });

  const claim = useMutation({
    mutationFn: (id) => tasks.claim(id),
    onSuccess: (d) => {
      toast.success(d.creditsAdded ? `+${d.creditsAdded} credits earned.` : 'Reward claimed.');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
    onError: (e) => toast.error(errMsg(e, 'This task isn’t complete yet — finish it, then claim.')),
  });

  const list = q.data?.tasks || [];

  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: '1.75rem' }}>Task Center</h2>
        <p className="text-muted">Small tasks, free credits. Complete one, then claim your reward.</p>
      </div>

      {q.isLoading && (
        <div className="grid grid-2"><SkeletonCard /><SkeletonCard /></div>
      )}
      {q.isError && <div className="warn-box" role="alert">{errMsg(q.error, 'Could not load tasks.')}</div>}
      {q.data && list.length === 0 && (
        <EmptyState icon="✓" title="All caught up" body="No tasks available right now — check back later." />
      )}

      <div className="grid grid-2">
        {list.map((t) => (
          <Card key={t.id}>
            <div className="row-between" style={{ marginBottom: '0.5rem' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t.title}</h3>
              {t.status === 'completed'
                ? <Badge variant="success">Completed</Badge>
                : <Badge variant="neutral">Available</Badge>}
            </div>
            <p className="small text-muted">{t.description}</p>
            <div className="row-between" style={{ marginTop: '1rem' }}>
              <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                +{t.credits} credits
              </span>
              <Button
                size="sm"
                variant={t.status === 'completed' ? 'secondary' : 'primary'}
                disabled={t.status === 'completed' || claim.isPending}
                onClick={() => claim.mutate(t.id)}
              >
                {t.status === 'completed' ? 'Claimed' : claim.isPending ? 'Claiming…' : 'Claim'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
