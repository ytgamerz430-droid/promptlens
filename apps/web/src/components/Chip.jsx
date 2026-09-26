import { toast } from 'react-toastify';

/** Click-to-copy keyword chip. */
export default function Chip({ text, className = '' }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed — select the text manually.');
    }
  };
  return (
    <button
      type="button"
      className={`chip chip-copy ${className}`}
      onClick={copy}
      title="Click to copy"
      aria-label={`Copy keyword ${text}`}
    >
      {text}
    </button>
  );
}
