import { useState } from 'react';
import type { CSSProperties } from 'react';

type Props = {
  fileType: 'headshot' | 'video';
  token: string;
  initialKey?: string;
  accept: string;
  maxSizeBytes: number;
  maxDurationSeconds?: number;
  onComplete: (r2Key: string) => void;
};

export default function FileUploader(props: Props) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneKey, setDoneKey] = useState<string | null>(props.initialKey ?? null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > props.maxSizeBytes) {
      setError(`File is too large (max ${(props.maxSizeBytes / 1024 / 1024).toFixed(0)} MB).`);
      return;
    }
    if (props.maxDurationSeconds && file.type.startsWith('video/')) {
      // Best-effort duration check. Some browsers (notably Safari/iOS WebKit)
      // refuse to read metadata for perfectly valid, playable files — e.g. an
      // mp4 carrying an embedded thumbnail track — and `duration` is sometimes
      // Infinity/NaN. In those cases we must NOT block the upload; we only
      // enforce the limit when we can read a finite duration. The size cap is
      // the hard backstop.
      try {
        const dur = await videoDuration(file);
        if (Number.isFinite(dur) && dur > props.maxDurationSeconds) {
          setError(`Video is ${Math.round(dur)}s (max ${props.maxDurationSeconds}s).`);
          return;
        }
      } catch {
        // Metadata unreadable in this browser — allow the upload to proceed.
      }
    }

    setFileName(file.name);

    // Get presigned URL
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: props.token,
        fileType: props.fileType,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    });
    // A failed presign can return a non-JSON / empty body (e.g. a 500/503). Parse
    // defensively so the applicant always sees a message instead of a silent
    // unhandled rejection.
    let presignJson: { ok?: boolean; uploadUrl?: string; r2Key?: string; error?: string } = {};
    try { presignJson = await presignRes.json(); } catch { /* non-JSON body */ }
    if (presignJson.error === 'upload_unavailable' || presignRes.status >= 500) {
      setError('Uploads are temporarily unavailable. Please try again in a few minutes.');
      return;
    }
    if (!presignRes.ok || !presignJson.ok || !presignJson.uploadUrl || !presignJson.r2Key) {
      setError(presignJson.error ?? 'Could not start upload.');
      return;
    }

    // Upload via XHR for progress events
    setProgress(0);
    let uploadOk = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 returned ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        xhr.open('PUT', presignJson.uploadUrl!);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
      uploadOk = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setProgress(null);
    }

    if (!uploadOk) return;

    // Record the R2 key on the D1 row
    const draftRes = await fetch('/api/applications/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: props.token, fileType: props.fileType, r2Key: presignJson.r2Key }),
    });
    if (!draftRes.ok) {
      const j = await draftRes.json() as { error?: string };
      setError(j.error ?? 'Could not save the upload.');
      setProgress(null);
      return;
    }
    setProgress(100);
    setDoneKey(presignJson.r2Key);
    props.onComplete(presignJson.r2Key);
  }

  const dropZone: CSSProperties = {
    border: '2px dashed #333', borderRadius: 8, padding: 24, textAlign: 'center',
    background: doneKey ? 'rgba(76,175,80,0.06)' : 'transparent',
    borderColor: doneKey ? '#4caf50' : (progress !== null ? '#F8B92F' : '#333'),
  };

  if (doneKey) {
    return (
      <div style={dropZone}>
        <div style={{ color: '#4caf50', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>&#10003; {fileName ?? 'Uploaded'}</div>
        <button type="button" onClick={() => { setDoneKey(null); setFileName(null); setProgress(null); }} style={{ background: 'transparent', border: 0, color: '#F8B92F', textDecoration: 'underline', cursor: 'pointer' }}>
          Replace
        </button>
      </div>
    );
  }

  if (progress !== null) {
    return (
      <div style={dropZone}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span>{fileName}</span><span style={{ color: '#F8B92F' }}>Uploading {progress}%</span>
        </div>
        <div style={{ height: 6, background: '#0d0d0d', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#F8B92F', transition: 'width 200ms' }} />
        </div>
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>Don't close this tab. Your magic-link email will let you resume if needed.</p>
      </div>
    );
  }

  return (
    <label style={{ ...dropZone, cursor: 'pointer', display: 'block' }}>
      <input
        type="file" accept={props.accept} hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f).catch(() => { setError('Something went wrong starting the upload. Please try again.'); setProgress(null); });
        }}
      />
      <div style={{ fontSize: 13, opacity: 0.85 }}>Drag a file here or <span style={{ color: '#F8B92F', textDecoration: 'underline' }}>browse</span></div>
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
        Max {(props.maxSizeBytes / 1024 / 1024).toFixed(0)} MB
        {props.maxDurationSeconds ? ` · max ${props.maxDurationSeconds}s` : ''}
      </div>
      {error && <p style={{ color: '#FF6B6B', fontSize: 13, marginTop: 8 }}>{error}</p>}
    </label>
  );
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    // Guard against metadata events never firing on some containers/browsers.
    const timer = setTimeout(() => { cleanup(); reject(new Error('metadata timeout')); }, 8000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { clearTimeout(timer); cleanup(); resolve(v.duration); };
    v.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('Could not read video metadata')); };
    v.src = url;
  });
}
