import { useQuery } from '@tanstack/react-query';
import { platforms } from '../api/client.js';
import { Select, Field } from './Input.jsx';
import { Skeleton } from './Skeleton.jsx';

export default function PlatformSelect({ value, onChange, label = 'Marketplace' }) {
  const q = useQuery({ queryKey: ['platforms'], queryFn: platforms.list, retry: 1 });

  if (q.isLoading) return <Skeleton height={38} />;
  if (q.isError || !q.data?.platforms?.length) {
    return (
      <Field label={label}>
        <div className="warn-box" role="alert">
          Couldn't load marketplaces. Please check your connection and try again.
        </div>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value, q.data.platforms)}>
        {q.data.platforms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Synchronous lookup of platform rules from cached platform list. */
export function platformById(list, id) {
  return (list || []).find((p) => p.id === id);
}
