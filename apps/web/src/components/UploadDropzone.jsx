import { useRef, useState } from 'react';
import { uploads, errMsg } from '../api/client.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 100;

export const DROPZONE_ACCEPT = '.jpg,.jpeg,.png,.webp';

function validate(file) {
  if (!ALLOWED.includes(file.type)) {
    return 'Only JPG, PNG, or WebP files are allowed.';
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return `File is too large — the limit is ${MAX_MB} MB.`;
  }
  return null;
}

export default function UploadDropzone({ onUploaded, multiple = false, hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null); // {name, pct}
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState([]);

  const handleFiles = async (files) => {
    setError('');
    const list = Array.from(files || []);
    if (!list.length) return;

    for (const file of list) {
      const problem = validate(file);
      if (problem) {
        setError(problem);
        continue;
      }
      setPreviews((p) => [...p, { name: file.name, url: URL.createObjectURL(file) }]);
      setProgress({ name: file.name, pct: 0 });
      try {
        const up = await uploads.upload(file, (pct) => setProgress({ name: file.name, pct }));
        onUploaded(up);
      } catch (e) {
        setError(errMsg(e, 'Upload failed. Please try again.'));
      } finally {
        setProgress(null);
      }
      if (!multiple) break;
    }
  };

  return (
    <div>
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload an image"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {previews.length > 0 && !multiple ? (
          <img className="dropzone-preview" src={previews[previews.length - 1].url} alt="Upload preview" />
        ) : (
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }} aria-hidden="true">🖼</div>
        )}
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
          {progress ? `Uploading ${progress.name}…` : 'Drag & drop an image, or click to browse'}
        </div>
        <div className="small text-muted">
          {hint || `JPG, PNG, or WebP — up to ${MAX_MB} MB${multiple ? ' each' : ''}.`}
        </div>
        {progress && (
          <div className="progress" style={{ marginTop: '1rem' }} role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${progress.pct}%` }} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={DROPZONE_ACCEPT}
          multiple={multiple}
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
      {error && (
        <div className="field-error" role="alert" style={{ marginTop: '0.5rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}
