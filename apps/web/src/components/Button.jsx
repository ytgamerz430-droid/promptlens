export default function Button({
  variant = 'primary',
  size,
  block,
  className = '',
  children,
  ...rest
}) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', block ? 'btn-block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
