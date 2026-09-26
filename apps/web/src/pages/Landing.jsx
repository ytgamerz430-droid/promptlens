import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reviews, billing } from '../api/client.js';
import { useStore } from '../store.js';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Logo from '../components/Logo.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

const NAV_ANCHORS = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#reviews', label: 'Reviews' },
  { href: '#faq', label: 'FAQ' },
];

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const token = useStore((s) => s.token);
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="brand" style={{ color: 'var(--accent)' }}>
          <Logo size={30} />
          <span style={{ color: 'var(--text)' }}>PromptLens</span>
        </Link>
        <nav className="site-nav desktop" aria-label="Sections">
          {NAV_ANCHORS.map((a) => (
            <a key={a.href} href={a.href}>{a.label}</a>
          ))}
        </nav>
        <div className="site-nav desktop">
          {token ? (
            <Link to="/dashboard" className="btn btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register" className="btn btn-primary">Get started free</Link>
            </>
          )}
        </div>
        <button
          className="hamburger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? '✕' : '☰'}
        </button>
      </div>
      <nav className={`mobile-nav${open ? ' open' : ''}`} aria-label="Mobile sections">
        {NAV_ANCHORS.map((a) => (
          <a key={a.href} href={a.href} onClick={() => setOpen(false)}>{a.label}</a>
        ))}
        {token ? (
          <Link to="/dashboard" className="btn btn-primary" onClick={() => setOpen(false)}>Open dashboard</Link>
        ) : (
          <>
            <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
            <Link to="/register" className="btn btn-primary" onClick={() => setOpen(false)}>Get started free</Link>
          </>
        )}
      </nav>
    </header>
  );
}

function DemoWidget() {
  const [phase, setPhase] = useState('analyzing');
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p === 'analyzing' ? 'result' : 'analyzing')), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="demo-widget card" aria-hidden="true">
      {phase === 'analyzing' ? (
        <div className="demo-stage">
          <div className="demo-analyzing">
            <div className="spinner" />
            <span style={{ fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.85rem' }}>ANALYZING</span>
          </div>
        </div>
      ) : (
        <div className="demo-stage">
          <div className="demo-photo">photo.jpg</div>
          <div className="demo-result-title">AI PROMPT · READY IN 2.8s</div>
          <div className="chip-wrap" style={{ marginBottom: '1rem' }}>
            <span className="chip">golden hour</span>
            <span className="chip">mountain lake</span>
            <span className="chip">cinematic light</span>
          </div>
          <div className="row-between">
            <Badge variant="success">Success</Badge>
            <span className="tiny text-faint">Demo preview</span>
          </div>
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  { icon: '✦', title: 'AI prompt studio', body: 'Upload a photo and get a vivid, ready-to-paste prompt for your favorite image generator.' },
  { icon: '🏷', title: 'Stock metadata', body: 'Titles, keywords, and descriptions tuned to each marketplace’s submission rules.' },
  { icon: '▦', title: 'Batch processing', body: 'Process a whole shoot at once. Watch each image move from queued to done.' },
  { icon: '◍', title: 'Deep analysis', body: 'A structured breakdown of subject, light, color, and composition — great for learning.' },
  { icon: '⚑', title: 'IP risk check', body: 'Flags logos, trademarks, and recognizable property before you publish or sell.' },
  { icon: '🔑', title: 'Bring your own key', body: 'Plug in your own provider key and generate without spending platform credits.' },
];

const STEPS = [
  { n: 1, title: 'Upload a photo', body: 'Drag in a JPG, PNG, or WebP — up to 100 MB. Your file stays private to your account.' },
  { n: 2, title: 'Pick a tool', body: 'Need an AI prompt, marketplace metadata, a deep breakdown, or a risk check? Choose one.' },
  { n: 3, title: 'Copy or export', body: 'Copy the result with one click, or export marketplace metadata as CSV.' },
];

const TUTORIAL = [
  { n: 1, title: 'Choose a clear photo', body: 'Sharp, well-lit images get the best descriptions. JPG, PNG, or WebP, up to 100 MB.' },
  { n: 2, title: 'Select your workflow', body: 'Prompt Studio for AI art, Stock Metadata for marketplaces, Analysis Lab for insight.' },
  { n: 3, title: 'Tune the options', body: 'Pick a marketplace, adjust title and keyword limits, or add your own instructions.' },
  { n: 4, title: 'Use the result', body: 'Copy individual keywords, copy everything at once, or download a CSV for bulk upload.' },
];

const FAQS = [
  { q: 'What does PromptLens actually do?', a: 'It looks at your photo and writes the words around it: an AI image prompt, or the title, keywords, and description that stock marketplaces ask for. You upload, it writes, you copy.' },
  { q: 'How much does it cost?', a: 'You get free credits every day, no card required. Each generation costs one credit. If you run out, you can upgrade to a plan or connect your own provider key and keep going for free.' },
  { q: 'Which marketplaces are supported?', a: 'Adobe Stock, Shutterstock, Vecteezy, Depositphotos, 123RF, and Dreamstime — plus a General mode with no limits. Each marketplace gets its own title-length and keyword-count rules.' },
  { q: 'What is BYOK?', a: '“Bring your own key.” If you have an API key from Gemini, Groq, Mistral, or OpenAI, add it in Settings. Generations with BYOK enabled use your key instead of spending credits.' },
  { q: 'Who owns the results?', a: 'You do. Anything generated from your uploads is yours to use, sell, or publish as you like.' },
  { q: 'What files can I upload?', a: 'JPG, PNG, or WebP, up to 100 MB each. Files are stored privately under your account and you can delete them anytime.' },
];

function stars(rating) {
  const full = Math.round(rating || 0);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}

function ReviewsSection() {
  const summaryQ = useQuery({ queryKey: ['reviews-summary'], queryFn: reviews.summary, retry: 1 });
  const listQ = useQuery({ queryKey: ['reviews', 'landing'], queryFn: () => reviews.list({ limit: 6 }), retry: 1 });

  if (summaryQ.isError && listQ.isError) return null;

  const summary = summaryQ.data;
  const items = listQ.data?.data || [];

  return (
    <section id="reviews" className="section">
      <div className="container">
        <div className="section-head">
          <h2>Loved by working creators</h2>
          {summary && (
            <p>
              <span className="review-stars" aria-label={`${summary.average} out of 5 stars`}>{stars(summary.average)}</span>
              <br />
              {summary.average?.toFixed(1)} average across {summary.count} reviews
            </p>
          )}
        </div>
        <div className="grid grid-3">
          {listQ.isLoading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
          {items.map((r) => (
            <Card key={r.id}>
              <div className="review-stars" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</div>
              <p className="small" style={{ margin: '0.75rem 0' }}>“{r.comment}”</p>
              <div className="tiny text-faint">— {r.name}</div>
            </Card>
          ))}
        </div>
        {!listQ.isLoading && items.length === 0 && (
          <p className="text-muted" style={{ textAlign: 'center' }}>No reviews yet — be the first after you try it.</p>
        )}
      </div>
    </section>
  );
}

function PricingSection() {
  const plansQ = useQuery({ queryKey: ['billing-plans'], queryFn: billing.plans, retry: 1 });
  const plans = plansQ.data?.plans || [];
  if (plansQ.isError || (!plansQ.isLoading && plans.length === 0)) return null;

  return (
    <section id="pricing" className="section">
      <div className="container">
        <div className="section-head">
          <h2>Simple pricing</h2>
          <p>Start free. Upgrade when your output outgrows the daily allowance.</p>
        </div>
        <div className="grid grid-3">
          {plansQ.isLoading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
          {plans.map((p) => (
            <Card key={p.id} className="pricing-card">
              <h3>{p.name}</h3>
              <div className="pricing-price">
                {p.price ? `${p.price} ${p.currency || ''}` : 'Free'}
                {p.interval && p.price ? <span className="small text-muted">/{p.interval}</span> : null}
              </div>
              <ul className="pricing-features">
                {(p.features || []).map((f, i) => <li key={i}>{f}</li>)}
                {p.creditsPerMonth != null && <li>{p.creditsPerMonth} credits / month</li>}
                {p.creditsPerDay != null && <li>{p.creditsPerDay} free credits / day</li>}
              </ul>
              <Link to="/register" className="btn btn-primary btn-block">Get started free</Link>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <button className="faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="faq-a">{a}</div>}
    </div>
  );
}

export default function Landing() {
  const token = useStore((s) => s.token);
  return (
    <div>
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="container">
            <h1>Turn photos into words that work.</h1>
            <p className="hero-sub">
              Upload a photo and get a sharp AI image prompt — or a marketplace-ready title,
              keywords, and description — in seconds.
            </p>
            <div className="hero-ctas">
              {token ? (
                <Link to="/dashboard" className="btn btn-primary">Open dashboard</Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary">Get started free</Link>
                  <a href="#how" className="btn btn-secondary">See how it works</a>
                </>
              )}
            </div>
            <DemoWidget />
          </div>
        </section>

        <section id="features" className="section">
          <div className="container">
            <div className="section-head">
              <h2>Everything around the image</h2>
              <p>One upload, many outputs — built for AI artists and stock contributors alike.</p>
            </div>
            <div className="grid grid-3">
              {FEATURES.map((f) => (
                <Card key={f.title} className="feature-card">
                  <div className="feature-icon" aria-hidden="true">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p className="small text-muted" style={{ margin: 0 }}>{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="section">
          <div className="container">
            <div className="section-head">
              <h2>How it works</h2>
              <p>Three steps, under a minute.</p>
            </div>
            <div className="grid grid-3">
              {STEPS.map((s) => (
                <Card key={s.n}>
                  <div className="step-num" aria-hidden="true">{s.n}</div>
                  <h3>{s.title}</h3>
                  <p className="small text-muted" style={{ margin: 0 }}>{s.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="tutorial" className="section">
          <div className="container">
            <div className="section-head">
              <h2>Get the best results</h2>
              <p>A quick walkthrough for your first generation.</p>
            </div>
            <div className="grid grid-4">
              {TUTORIAL.map((t) => (
                <Card key={t.n}>
                  <div className="step-num" aria-hidden="true">{t.n}</div>
                  <h3 style={{ fontSize: '1.05rem' }}>{t.title}</h3>
                  <p className="small text-muted" style={{ margin: 0 }}>{t.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <ReviewsSection />

        <section id="faq" className="section">
          <div className="container">
            <div className="section-head">
              <h2>Questions, answered</h2>
            </div>
            <div className="faq-list">
              {FAQS.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </section>

        <PricingSection />

        <section className="final-cta">
          <div className="container">
            <h2>Your next photo is already half-written.</h2>
            <p className="text-muted" style={{ marginBottom: '1.75rem' }}>
              Upload it, and let PromptLens finish the sentence.
            </p>
            {token ? (
              <Link to="/dashboard" className="btn btn-primary">Open dashboard</Link>
            ) : (
              <Link to="/register" className="btn btn-primary">Get started free</Link>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <Link to="/" className="brand" style={{ color: 'var(--accent)' }}>
            <Logo size={26} />
            <span style={{ color: 'var(--text)' }}>PromptLens</span>
          </Link>
          <nav className="footer-links" aria-label="Footer">
            {NAV_ANCHORS.map((a) => (
              <a key={a.href} href={a.href}>{a.label}</a>
            ))}
            <a href="#pricing">Pricing</a>
            {token ? (
              <Link to="/dashboard">Dashboard</Link>
            ) : (
              <>
                <Link to="/login">Sign in</Link>
                <Link to="/register">Get started free</Link>
              </>
            )}
          </nav>
        </div>
        <div className="container">
          <p className="tiny text-faint" style={{ marginTop: '1.5rem' }}>
            An independent implementation. Your uploads and results belong to you.
          </p>
        </div>
      </footer>
    </div>
  );
}
