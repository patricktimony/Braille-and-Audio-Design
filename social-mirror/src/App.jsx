import { useEffect, useMemo, useRef, useState } from 'react';

const CATEGORY_LABELS = {
  personality: 'Personality',
  facial_expression: 'Facial expressions',
  voice: 'Voice',
  mannerisms: 'Mannerisms',
  music_or_work: 'Music / work',
  politics: 'Politics',
  other_topic: 'Other topics',
};
const PERSON_CATS = ['personality', 'facial_expression', 'voice', 'mannerisms'];
const FILTERS = [
  { id: 'person', label: 'About the person', match: (t) => t.aboutPerson },
  ...PERSON_CATS.map((c) => ({ id: c, label: CATEGORY_LABELS[c], match: (t) => t.category === c })),
  { id: 'other', label: 'Music, politics & other', match: (t) => !t.aboutPerson },
];
const POLARITY = {
  positive: { sym: '+', label: 'mostly positive' },
  negative: { sym: '−', label: 'mostly negative' },
  mixed: { sym: '±', label: 'mixed' },
  neutral: { sym: '·', label: 'neutral' },
};
const PLATFORM = { youtube: 'YouTube', reddit: 'Reddit' };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export default function App() {
  const [config, setConfig] = useState(null);
  const [url, setUrl] = useState('');
  const [person, setPerson] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('person');
  const [minCount, setMinCount] = useState(1);
  const evidenceRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => setConfig({ keys: {}, offline: true }));
  }, []);

  async function load({ demo = false, refresh = false, url: urlArg = url, person: personArg = person } = {}) {
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlArg, person: personArg, demo, refresh }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);
      setData(body);
      setMinCount(1);
      requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selected) evidenceRef.current?.focus();
  }, [selected]);

  const commentsById = useMemo(() => new Map((data?.comments || []).map((c) => [c.id, c])), [data]);
  const visibleTerms = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    return (data?.terms || []).filter((t) => f.match(t) && t.commenters >= minCount).slice(0, 70);
  }, [data, filter, minCount]);
  const selectedTerm = data?.terms.find((t) => t.term === selected);

  return (
    <div className="app">
      <header className="top">
        <h1>Social Mirror</h1>
        <p className="tagline">How people publicly describe a public figure — with the receipts.</p>
        <KeyStatus config={config} />
      </header>

      <form
        className="loader"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label className="field grow">
          <span>YouTube video URL</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" required />
        </label>
        <label className="field">
          <span>Person's name <small>(optional)</small></span>
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="e.g. Billy Corgan" />
        </label>
        <div className="actions">
          <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load video'}</button>
          <button type="button" className="secondary" disabled={loading} onClick={() => load({ demo: true })}>
            Demo mode
          </button>
        </div>
      </form>

      <FeaturedClips
        config={config}
        disabled={loading}
        currentId={data?.video?.id}
        onPick={(clip, name) => {
          setUrl(clip.url);
          setPerson(name);
          load({ url: clip.url, person: name });
        }}
      />

      <div role="status" aria-live="polite" className="status">
        {loading && 'Fetching comments and analyzing them. The first load of a video can take a minute; repeat loads come from the cache.'}
        {error && <p className="error">{error}</p>}
      </div>

      {data && (
        <>
          {data.demo && (
            <p className="demo-banner" role="note">
              <strong>DEMO — SAMPLE DATA.</strong> Every comment here is fictional and was written for this demo. It is not about
              any real person, and the labels were hand-written, not produced by AI.
            </p>
          )}

          <section className="stage" aria-label="Video and word cloud" ref={stageRef}>
            <div className="video">
              {data.video.id ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${data.video.id}?playsinline=1`}
                  title={`YouTube video: ${data.video.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="video-placeholder">Demo video placeholder</div>
              )}
              <p className="video-title">
                {data.video.title} <span className="muted">· {data.video.channel}</span>
              </p>
            </div>

            <div className="cloud-panel">
              <h2>
                How commenters describe{' '}
                <span className="person">{data.person || 'this person'}</span>
              </h2>
              {data.personSource === 'ai' && (
                <p className="muted small">Name identified by AI from the video title — type it yourself if it's wrong.</p>
              )}
              <div className="filters" role="group" aria-label="Show descriptions about">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={filter === f.id} className="chip" onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <WordCloud terms={visibleTerms} selected={selected} onSelect={setSelected} aiStatus={data.sources.ai} />
              <div className="cloud-foot">
                <label className="min-count">
                  Minimum commenters:{' '}
                  <input type="number" min="1" value={minCount} onChange={(e) => setMinCount(Math.max(1, Number(e.target.value) || 1))} />
                </label>
                <p className="muted small">
                  Words are <strong>AI-generated labels</strong> summarizing real comments. Size and the small number = distinct
                  commenters. <span className="key positive">Solid underline: positive</span>,{' '}
                  <span className="key negative">dashed: negative</span>, <span className="key mixed">dotted: mixed</span>,{' '}
                  <span className="key neutral">none: neutral</span>. Select a word to see the actual comments.
                </p>
              </div>
            </div>
          </section>

          {selectedTerm && (
            <Evidence
              term={selectedTerm}
              commentsById={commentsById}
              innerRef={evidenceRef}
              onClose={() => setSelected(null)}
            />
          )}

          <WordSearch key={data.video.id || "demo"} comments={data.comments} />
          <Sources data={data} onRefresh={() => load({ refresh: true })} />
        </>
      )}
    </div>
  );
}

const fmtDuration = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const fmtAge = (iso) => {
  const days = Math.round((Date.now() - new Date(iso)) / 86400000);
  return days < 1 ? 'today' : days < 31 ? plural(days, 'day') + ' ago' : plural(Math.round(days / 30), 'month') + ' ago';
};

function FeaturedClips({ config, onPick, disabled, currentId }) {
  const [extra, setExtra] = useState([]);
  const [newName, setNewName] = useState('');
  if (!config || config.offline) return null;
  const people = [...(config.featured || []), ...extra];
  return (
    <section className="featured" aria-labelledby="featured-title">
      <h2 id="featured-title">Featured people: recent short clips</h2>
      <p className="muted small">
        Found live with YouTube search: published in the last 6 months, under 20 minutes, with at least 20 comments. Select a clip to
        load its word cloud.
      </p>
      {!config.keys.youtube ? (
        <p className="cloud-empty small">Finding clips needs a YouTube API key on the server (see README). Demo mode still works.</p>
      ) : (
        people.map((name) => <ClipRow key={name} name={name} onPick={onPick} disabled={disabled} currentId={currentId} />)
      )}
      {config.keys.youtube && (
        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            const n = newName.trim();
            if (n && !people.some((p) => p.toLowerCase() === n.toLowerCase())) setExtra([...extra, n]);
            setNewName('');
          }}
        >
          <label className="field grow">
            <span>Find clips of someone else</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
          </label>
          <button type="submit" className="secondary">Find clips</button>
        </form>
      )}
    </section>
  );
}

function ClipRow({ name, onPick, disabled, currentId }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    fetch(`/api/clips?person=${encodeURIComponent(name)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `Server error ${r.status}`);
        return body;
      })
      .then((body) => live && setState({ clips: body.clips }))
      .catch((err) => live && setState({ error: err.message }));
    return () => {
      live = false;
    };
  }, [name]);
  return (
    <div className="clip-row">
      <h3>{name}</h3>
      {state.loading && <p className="muted small">Searching YouTube…</p>}
      {state.error && <p className="error small">{state.error}</p>}
      {state.clips?.length === 0 && <p className="muted small">No recent short clips with enough comments were found.</p>}
      {state.clips?.length > 0 && (
        <ul className="clips">
          {state.clips.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="clip"
                disabled={disabled}
                aria-current={currentId === c.id ? 'true' : undefined}
                onClick={() => onPick(c, name)}
              >
                <span className="thumb">
                  {c.thumbnail && <img src={c.thumbnail} alt="" loading="lazy" />}
                  <span className="duration">{fmtDuration(c.seconds)}</span>
                </span>
                <span className="clip-title">{c.title}</span>
                <span className="clip-meta">
                  {c.channel} · {fmtAge(c.publishedAt)} · {c.commentCount.toLocaleString()} comments
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KeyStatus({ config }) {
  if (!config) return null;
  if (config.offline) return <p className="error">Cannot reach the server on port 3001. Is it running?</p>;
  const k = config.keys;
  const item = (ok, label) => (
    <li className={ok ? 'ok' : 'missing'}>
      {ok ? '✓' : '✗'} {label} {ok ? 'key set' : 'key missing'}
    </li>
  );
  return (
    <ul className="keys" aria-label="Server API key status">
      {item(k.youtube, 'YouTube')}
      {item(k.anthropic, 'AI (Anthropic)')}
      {item(k.reddit, 'Reddit')}
    </ul>
  );
}

// Biggest words in the middle, smaller ones fanning out to both sides.
function centerOut(terms) {
  const out = [];
  terms.forEach((t, i) => (i % 2 ? out.push(t) : out.unshift(t)));
  return out;
}

function WordCloud({ terms, selected, onSelect, aiStatus }) {
  if (!terms.length) {
    const reason = aiStatus?.reason || (aiStatus?.status === 'ok' || aiStatus?.status === 'demo' ? 'No descriptions match this filter.' : 'No word cloud available.');
    return <p className="cloud-empty">{reason}</p>;
  }
  const max = Math.max(...terms.map((t) => t.commenters));
  return (
    <ul className="cloud" aria-label="Word cloud of descriptions">
      {centerOut(terms).map((t, i) => {
        const scale = max === 1 ? 0.35 : Math.pow((t.commenters - 1) / (max - 1), 0.6);
        const p = POLARITY[t.polarity] || POLARITY.neutral;
        return (
          <li key={t.term} style={{ '--delay': `${(i * 0.37) % 4}s` }}>
            <button
              type="button"
              className={`word ${t.polarity}`}
              style={{ '--s': scale }}
              aria-pressed={selected === t.term}
              aria-label={`${t.term}: ${plural(t.commenters, 'commenter')}, ${p.label}, ${CATEGORY_LABELS[t.category]}`}
              onClick={() => onSelect(selected === t.term ? null : t.term)}
            >
              {t.term}
              <span className="count" aria-hidden="true">
                {t.commenters}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Highlighted({ text, quote }) {
  const i = text.toLowerCase().indexOf(quote.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + quote.length)}</mark>
      {text.slice(i + quote.length)}
    </>
  );
}

function CommentCard({ comment, quote, note }) {
  return (
    <li className="comment">
      <div className="comment-meta">
        <span className={`badge ${comment.platform}`}>{PLATFORM[comment.platform]}</span>
        <span className="author">{comment.author}</span>
        {comment.context && <span className="muted small">{comment.context}</span>}
      </div>
      <blockquote>{quote ? <Highlighted text={comment.text} quote={quote} /> : comment.text}</blockquote>
      <div className="comment-foot">
        {note && <span className="small">{note}</span>}
        {comment.url ? (
          <a href={comment.url} target="_blank" rel="noreferrer">
            Open on {PLATFORM[comment.platform]} ↗
          </a>
        ) : (
          <span className="muted small">No link (demo data)</span>
        )}
      </div>
    </li>
  );
}

function Evidence({ term, commentsById, innerRef, onClose }) {
  const verbatim = term.evidence.filter((e) => e.verbatim);
  const inferred = term.evidence.filter((e) => !e.verbatim);
  return (
    <section className="evidence" aria-labelledby="evidence-title">
      <div className="evidence-head">
        <h2 id="evidence-title" tabIndex={-1} ref={innerRef}>
          Evidence for “{term.term}”
        </h2>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="ai-note">
        <strong>AI summary label:</strong> “{term.term}” is a label the AI attached to these comments (
        {CATEGORY_LABELS[term.category]}, {POLARITY[term.polarity]?.label}). The comments below are the commenters' own words,
        unedited.
      </p>
      <dl className="counts">
        <div>
          <dt>Distinct commenters</dt>
          <dd>{term.commenters}</dd>
        </div>
        <div>
          <dt>YouTube</dt>
          <dd>{term.byPlatform.youtube}</dd>
        </div>
        <div>
          <dt>Reddit</dt>
          <dd>{term.byPlatform.reddit}</dd>
        </div>
        <div>
          <dt>Used the word “{term.term}” themselves</dt>
          <dd>{term.verbatimCommenters}</dd>
        </div>
      </dl>
      {verbatim.length > 0 && (
        <>
          <h3>Comments that use the word “{term.term}” ({verbatim.length})</h3>
          <ul className="comments">
            {verbatim.map((e) => (
              <CommentCard key={e.commentId} comment={commentsById.get(e.commentId)} quote={e.quote} />
            ))}
          </ul>
        </>
      )}
      {inferred.length > 0 && (
        <>
          <h3>Comments the AI grouped under “{term.term}” without that exact word ({inferred.length})</h3>
          <p className="muted small">These commenters did not write “{term.term}”. Judge for yourself whether the label fits.</p>
          <ul className="comments">
            {inferred.map((e) => (
              <CommentCard
                key={e.commentId}
                comment={commentsById.get(e.commentId)}
                quote={e.quote}
                note={`Highlighted: the passage the AI cited.`}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function WordSearch({ comments }) {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = useMemo(() => {
    const w = submitted.trim().toLowerCase();
    if (!w) return null;
    const re = new RegExp(`(^|[^\\p{L}])${escapeRe(w)}`, 'iu');
    return comments.filter((c) => re.test(c.text));
  }, [submitted, comments]);
  const authors = results ? new Set(results.map((c) => c.authorKey)).size : 0;
  return (
    <section className="search" aria-labelledby="search-title">
      <h2 id="search-title">Did anyone actually say it?</h2>
      <p className="muted">Plain text search of every retrieved comment. No AI involved.</p>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q);
        }}
      >
        <label className="field grow">
          <span>Word or phrase</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="snide" />
        </label>
        <button type="submit">Search comments</button>
      </form>
      {results && (
        <div aria-live="polite">
          <p className="search-summary">
            “{submitted}” appears in <strong>{plural(results.length, 'comment')}</strong> from{' '}
            <strong>{plural(authors, 'distinct commenter')}</strong> (out of {comments.length} retrieved comments).
            {results.length > 0 &&
              ` YouTube: ${results.filter((c) => c.platform === 'youtube').length}, Reddit: ${results.filter((c) => c.platform === 'reddit').length}.`}
          </p>
          <ul className="comments">
            {results.slice(0, 50).map((c) => (
              <CommentCard key={c.id} comment={c} quote={submitted.trim()} />
            ))}
          </ul>
          {results.length > 50 && <p className="muted">Showing the first 50.</p>}
        </div>
      )}
    </section>
  );
}

function SourceLine({ name, s }) {
  if (!s) return null;
  const label = {
    ok: 'Loaded',
    demo: 'Demo sample',
    partial: 'Partly loaded',
    unavailable: 'Unavailable',
    not_configured: 'Not configured',
    needs_person: 'Waiting for a name',
    skipped: 'Skipped',
  }[s.status];
  return (
    <li>
      <strong>{name}:</strong> <span className={`src ${s.status}`}>{label}</span>
      {typeof s.count === 'number' && ` — ${plural(s.count, 'comment')}`}
      {s.totalOnVideo > 0 && ` (of ${s.totalOnVideo.toLocaleString()} on the video; most relevant first)`}
      {s.reason && <div className="small">{s.reason}</div>}
      {s.note && <div className="small">{s.note}</div>}
      {s.cachedAt && <div className="small muted">From cache, saved {new Date(s.cachedAt).toLocaleString()}</div>}
      {s.threads?.length > 0 && (
        <ul className="threads">
          {s.threads.map((t) => (
            <li key={t.url}>
              <a href={t.url} target="_blank" rel="noreferrer">
                r/{t.subreddit}: {t.title}
              </a>{' '}
              <span className="muted small">({t.matchedBy})</span>
            </li>
          ))}
        </ul>
      )}
      {s.model && (
        <div className="small">
          Model {s.model}; {plural(s.batches, 'batch', 'batches')}
          {s.failedBatches?.length > 0 && `, ${s.failedBatches.length} failed (${s.failedBatches[0].error})`}
          {`; ${plural(s.rejectedQuotes, 'AI label')} discarded because the cited quote was not found in the comment`}
          {s.truncatedComments > 0 && `; ${plural(s.truncatedComments, 'long comment')} analyzed only in their first ${s.maxCommentChars} characters`}.
        </div>
      )}
    </li>
  );
}

function Sources({ data, onRefresh }) {
  const { stats, sources } = data;
  return (
    <section className="sources" aria-labelledby="sources-title">
      <h2 id="sources-title">Sample size and sources</h2>
      <p>
        {plural(stats.comments, 'comment')} from {plural(stats.distinctCommenters, 'distinct commenter')} (YouTube{' '}
        {stats.byPlatform.youtube}, Reddit {stats.byPlatform.reddit}). {plural(stats.commentsWithDescriptors, 'comment')} contained
        a description of the person.
      </p>
      <ul className="source-list">
        <SourceLine name="YouTube comments" s={sources.youtube} />
        <SourceLine name="Reddit comments" s={sources.reddit} />
        <SourceLine name="AI extraction" s={sources.ai} />
      </ul>
      <p className="muted small">
        This is a sample of public comments, not a poll. People who comment are not representative of everyone. Nothing here is
        inferred from the person's face or the video itself.
      </p>
      {!data.demo && (
        <button type="button" className="secondary" onClick={onRefresh}>
          Re-fetch (bypass cache)
        </button>
      )}
    </section>
  );
}
