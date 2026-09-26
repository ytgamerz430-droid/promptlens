export default function Skeleton({ height = 16, width = '100%', style }) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="card stack">
      <Skeleton width="40%" height={20} />
      <Skeleton />
      <Skeleton width="80%" />
    </div>
  );
}
