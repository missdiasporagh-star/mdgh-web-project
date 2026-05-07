import { useState } from 'react';
import FileUploader from './FileUploader';

type Props = {
  token: string;
  reference: string;
  cycleClose: string;
  initialHeadshotKey?: string;
  initialVideoKey?: string;
};

type FormState = {
  fullName: string; phone: string; dateOfBirth: string;
  countryOfResidence: string; currentCity: string; countryOfHeritage: string;
  bio: string;
  socials: { instagram: string; tiktok: string; twitter: string; linkedin: string };
};

const EMPTY: FormState = {
  fullName: '', phone: '', dateOfBirth: '',
  countryOfResidence: '', currentCity: '', countryOfHeritage: '',
  bio: '', socials: { instagram: '', tiktok: '', twitter: '', linkedin: '' },
};

export default function ApplyForm(props: Props) {
  const [state, setState] = useState<FormState>(EMPTY);
  const [headshotKey, setHeadshotKey] = useState<string | undefined>(props.initialHeadshotKey);
  const [videoKey, setVideoKey] = useState<string | undefined>(props.initialVideoKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    state.fullName.trim().length >= 1 &&
    state.phone.trim().length >= 5 &&
    /^\d{4}-\d{2}-\d{2}$/.test(state.dateOfBirth) &&
    state.countryOfResidence.trim().length >= 1 &&
    state.currentCity.trim().length >= 1 &&
    state.countryOfHeritage.trim().length >= 1 &&
    state.bio.trim().length >= 50 &&
    state.bio.length <= 1500 &&
    !!headshotKey && !!videoKey;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch('/api/applications/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: props.token, ...state }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json() as { error?: string; reason?: string };
      setError(j.error === 'invalid_input' ? 'Some fields are missing or invalid.' : (j.reason ?? 'Submission failed.'));
      return;
    }
    window.location.href = `/apply/done?ref=${encodeURIComponent(props.reference)}`;
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState(s => ({ ...s, [k]: v }));
  }
  function setSocial<K extends keyof FormState['socials']>(k: K, v: string) {
    setState(s => ({ ...s, socials: { ...s.socials, [k]: v } }));
  }

  return (
    <form onSubmit={submit}>
      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>About you</div>
        <div className="field-row">
          <div><label className="muted" style={{ fontSize: 11 }}>Full name</label>
            <input className="input" value={state.fullName} onChange={e => set('fullName', e.target.value)} maxLength={120} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Phone (with country code)</label>
            <input className="input" value={state.phone} onChange={e => set('phone', e.target.value)} maxLength={40} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Date of birth</label>
            <input className="input" type="date" value={state.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Country of residence</label>
            <input className="input" value={state.countryOfResidence} onChange={e => set('countryOfResidence', e.target.value)} maxLength={80} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Current city</label>
            <input className="input" value={state.currentCity} onChange={e => set('currentCity', e.target.value)} maxLength={80} required /></div>
          <div><label className="muted" style={{ fontSize: 11 }}>Country of heritage</label>
            <input className="input" value={state.countryOfHeritage} onChange={e => set('countryOfHeritage', e.target.value)} maxLength={80} required /></div>
        </div>
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Your story</div>
        <label className="muted" style={{ fontSize: 11 }}>Bio ({state.bio.length}/1500 chars, min 50)</label>
        <textarea
          className="input" rows={6} value={state.bio}
          onChange={e => set('bio', e.target.value)}
          maxLength={1500}
          placeholder="Tell us who you are, what you carry, and what platform you would champion as queen&#8230;" required
        />
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Socials (optional)</div>
        <div className="field-row">
          <input className="input" placeholder="@instagram" value={state.socials.instagram} onChange={e => setSocial('instagram', e.target.value)} maxLength={80} />
          <input className="input" placeholder="@tiktok" value={state.socials.tiktok} onChange={e => setSocial('tiktok', e.target.value)} maxLength={80} />
          <input className="input" placeholder="@twitter" value={state.socials.twitter} onChange={e => setSocial('twitter', e.target.value)} maxLength={80} />
          <input className="input" placeholder="linkedin url" value={state.socials.linkedin} onChange={e => setSocial('linkedin', e.target.value)} maxLength={200} />
        </div>
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Headshot</div>
        <FileUploader
          fileType="headshot" token={props.token} initialKey={headshotKey}
          accept="image/jpeg,image/png,image/webp" maxSizeBytes={10 * 1024 * 1024}
          onComplete={setHeadshotKey}
        />
      </section>

      <section className="card">
        <div className="label" style={{ marginBottom: 12 }}>Intro video (up to 2 minutes)</div>
        <FileUploader
          fileType="video" token={props.token} initialKey={videoKey}
          accept="video/mp4,video/quicktime,video/webm" maxSizeBytes={300 * 1024 * 1024}
          maxDurationSeconds={120}
          onComplete={setVideoKey}
        />
      </section>

      {error && <p className="err" style={{ textAlign: 'center', marginBottom: 8 }}>{error}</p>}

      <button type="submit" className="btn" style={{ width: '100%', padding: 16, fontSize: 16 }} disabled={!isValid || submitting}>
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
