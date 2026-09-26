import Button from './Button.jsx';

export default function Pagination({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'center', marginTop: '1.5rem' }} role="navigation" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </Button>
      <span className="small text-muted" aria-live="polite">
        Page {page} of {pages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </Button>
    </div>
  );
}
