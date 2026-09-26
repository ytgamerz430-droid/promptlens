import { useState } from 'react';
import { toast } from 'react-toastify';
import Button from './Button.jsx';

export default function CopyButton({ text, label = 'Copy', variant = 'secondary', size }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Copy failed — select the text manually.');
    }
  };

  return (
    <Button variant={variant} size={size} onClick={copy} disabled={!text}>
      {copied ? 'Copied ✓' : label}
    </Button>
  );
}
