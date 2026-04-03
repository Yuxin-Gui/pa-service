import { useState, useEffect, useCallback, useRef } from "react";

// ── API helpers ──────────────────────────────────────────────────────────────
const BASE = "http://localhost:8000/api";

async function api(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || r.statusText);
  }
  if (r.status === 204) return null;
  return r.json();
}

// ── Colour / priority helpers ────────────────────────────────────────────────
const PRIORITY_COLOR = { high: "#e05252", medium: "#e0a033", low: "#52b788" };
const STATUS_COLOR   = { pending: "#7c8cf8", in_progress: "#e0a033", done: "#52b788" };

// ── Icons (inline SVG) ───────────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  tasks:    "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  github:   "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22",
  mastodon: "M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m4 4V7",
  chat:     "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  plus:     "M12 5v14M5 12h14",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  check:    "M20 6L9 17l-5-5",
  refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  alert:    "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  send:     "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
};

// ── Small components ─────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span style={{
      background: color + "22", color,
      border: `1px solid ${color}44`,
      borderRadius: 4, padding: "2px 8px",
      fontSize: 11, fontWeight: 700,
      letterSpacing: "0.05em", textTransform: "uppercase",
    }}>
      {label}
    </span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "20px 22px",
      cursor: onClick ? "pointer" : undefined,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, color: "#8899aa", fontWeight: 600 }}>{label}</label>}
      <input style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8, padding: "8px 12px",
        color: "#e8eaf0", fontSize: 14, outline: "none", fontFamily: "inherit",
      }} {...props} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, color: "#8899aa", fontWeight: 600 }}>{label}</label>}
      <select style={{
        background: "#1a1e2e",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8, padding: "8px 12px",
        color: "#e8eaf0", fontSize: 14, outline: "none", fontFamily: "inherit",
      }} {...props}>
        {children}
      </select>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", small, disabled }) {
  const bg = variant === "primary" ? "#7c8cf8" : variant === "danger" ? "#e05252" : "rgba(255,255,255,0.07)";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: bg, color: "#fff", border: "none",
      borderRadius: 8, padding: small ? "5px 12px" : "9px 18px",
      fontSize: small ? 12 : 14, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      display: "flex", alignItems: "center", gap: 6,
      fontFamily: "inherit", letterSpacing: "0.03em",
    }}>
      {children}
    </button>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{ background: "rgba(124,140,248,0.15)", borderRadius: 8, padding: 8, display: "flex", color: "#7c8cf8" }}>
        <Icon d={ICONS[icon]} size={16} />
      </div>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: "0.04em", color: "#e8eaf0" }}>
        {title}
      </h2>
    </div>
  );
}

// ── TASKS PANEL ──────────────────────────────────────────────────────────────
function TasksPanel() {
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ title: "", description: "", priority: "medium", due_date: "" });
  const [error, setError]   = useState("");

  const load = useCallback(async () => {
    try { setTasks(await api("/tasks/")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim()) return;
    try {
      await api("/tasks/", { method: "POST", body: JSON.stringify({ ...form, due_date: form.due_date || null }) });
      setForm({ title: "", description: "", priority: "medium", due_date: "" });
      load();
    } catch (e) { setError(e.message); }
  };

  const updateStatus = async (id, status) => {
    try { await api(`/tasks/${id}/status?status=${status}`, { method: "PATCH" }); load(); }
    catch (e) { setError(e.message); }
  };

  const deleteTask = async (id) => {
    try { await api(`/tasks/${id}`, { method: "DELETE" }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      <SectionHeader icon="tasks" title="Task Manager" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Task Title" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Write final report..." />
          <Input label="Due Date (optional)" type="date" value={form.due_date}
            onChange={e => setForm({ ...form, due_date: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
          <Input label="Description (optional)" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="More details..." />
          <Select label="Priority" value={form.priority}
            onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Btn onClick={create}><Icon d={ICONS.plus} size={14} /> Add Task</Btn>
        </div>
      </Card>

      {error && <div style={{ color: "#e05252", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "#8899aa", textAlign: "center", padding: 32 }}>Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div style={{ color: "#8899aa", textAlign: "center", padding: 32 }}>No tasks yet — create one above!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map(t => (
            <Card key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#e8eaf0" }}>{t.title}</span>
                  <Badge label={t.priority} color={PRIORITY_COLOR[t.priority]} />
                  <Badge label={t.status.replace("_", " ")} color={STATUS_COLOR[t.status]} />
                </div>
                {t.description && <div style={{ fontSize: 12, color: "#8899aa", marginBottom: 4 }}>{t.description}</div>}
                {t.due_date && <div style={{ fontSize: 11, color: "#556" }}>📅 Due: {t.due_date}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {t.status === "pending" && (
                  <Btn small variant="ghost" onClick={() => updateStatus(t.id, "in_progress")}>Start</Btn>
                )}
                {t.status === "in_progress" && (
                  <Btn small variant="ghost" onClick={() => updateStatus(t.id, "done")}>
                    <Icon d={ICONS.check} size={12} /> Done
                  </Btn>
                )}
                <Btn small variant="danger" onClick={() => deleteTask(t.id)}>
                  <Icon d={ICONS.trash} size={12} />
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SCHEDULER PANEL ──────────────────────────────────────────────────────────
function SchedulerPanel() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ title: "", datetime_iso: "", description: "", reminder_minutes: 30 });
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    try { setEvents(await api("/scheduler/")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim() || !form.datetime_iso) return;
    try {
      await api("/scheduler/", { method: "POST", body: JSON.stringify(form) });
      setForm({ title: "", datetime_iso: "", description: "", reminder_minutes: 30 });
      load();
    } catch (e) { setError(e.message); }
  };

  const deleteEvent = async (id) => {
    try { await api(`/scheduler/${id}`, { method: "DELETE" }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      <SectionHeader icon="calendar" title="Scheduler" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Event Title" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Team standup..." />
          <Input label="Date & Time" type="datetime-local" value={form.datetime_iso}
            onChange={e => setForm({ ...form, datetime_iso: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
          <Input label="Description (optional)" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="What's this about?" />
          <Select label="Remind (min)" value={form.reminder_minutes}
            onChange={e => setForm({ ...form, reminder_minutes: Number(e.target.value) })}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
          </Select>
          <Btn onClick={create}><Icon d={ICONS.plus} size={14} /> Add Event</Btn>
        </div>
      </Card>

      {error && <div style={{ color: "#e05252", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "#8899aa", textAlign: "center", padding: 32 }}>Loading events...</div>
      ) : events.length === 0 ? (
        <div style={{ color: "#8899aa", textAlign: "center", padding: 32 }}>No events yet — schedule something above!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map(e => (
            <Card key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e8eaf0", marginBottom: 4 }}>{e.title}</div>
                <div style={{ fontSize: 13, color: "#7c8cf8", marginBottom: 4 }}>
                  📅 {new Date(e.datetime_iso).toLocaleString()}
                </div>
                {e.description && <div style={{ fontSize: 12, color: "#8899aa", marginBottom: 4 }}>{e.description}</div>}
                <div style={{ fontSize: 11, color: "#556" }}>⏰ Reminder: {e.reminder_minutes} min before</div>
              </div>
              <Btn small variant="danger" onClick={() => deleteEvent(e.id)}>
                <Icon d={ICONS.trash} size={12} />
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GITHUB PANEL ─────────────────────────────────────────────────────────────
function GitHubPanel() {
  const [form, setForm]       = useState({ owner: "anthropics", repo: "anthropic-sdk-python", token: "" });
  const [result, setResult]   = useState(null);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    api("/github/trending").then(setTrending).catch(() => {});
  }, []);

  const analyse = async () => {
    setLoading(true); setError(""); setResult(null);
    try { setResult(await api("/github/analyse", { method: "POST", body: JSON.stringify(form) })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <SectionHeader icon="github" title="GitHub Agent" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Owner" value={form.owner}
            onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="anthropics" />
          <Input label="Repository" value={form.repo}
            onChange={e => setForm({ ...form, repo: e.target.value })} placeholder="anthropic-sdk-python" />
          <Input label="Token (optional)" value={form.token} type="password"
            onChange={e => setForm({ ...form, token: e.target.value })} placeholder="ghp_..." />
        </div>
        <Btn onClick={analyse} disabled={loading}>
          {loading ? "Analysing with AI..." : <><Icon d={ICONS.refresh} size={14} /> Analyse Repo</>}
        </Btn>
      </Card>

      {error && <div style={{ color: "#e05252", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {result && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
              <div><div style={{ fontSize: 24, fontWeight: 900, color: "#7c8cf8" }}>{result.stars.toLocaleString()}</div><div style={{ fontSize: 11, color: "#8899aa" }}>STARS</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 900, color: "#52b788" }}>{result.forks.toLocaleString()}</div><div style={{ fontSize: 11, color: "#8899aa" }}>FORKS</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 900, color: "#e0a033" }}>{result.open_issues}</div><div style={{ fontSize: 11, color: "#8899aa" }}>OPEN ISSUES</div></div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginBottom: 4 }}>{result.repo}</div>
                <div style={{ fontSize: 12, color: "#8899aa", marginBottom: 6 }}>{result.description}</div>
                <Badge label={result.language} color="#7c8cf8" />
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", marginBottom: 6 }}>🤖 AI VIBE SUMMARY</div>
            <div style={{
              background: "rgba(124,140,248,0.08)", borderRadius: 8,
              padding: "12px 16px", fontSize: 13, color: "#c8d0e8",
              lineHeight: 1.7, borderLeft: "3px solid #7c8cf8",
            }}>
              {result.vibe_summary}
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8899aa", marginBottom: 8 }}>RECENT COMMITS</div>
              {result.recent_commits.slice(0, 5).map((c, i) => (
                <Card key={i} style={{ padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#7c8cf8", marginBottom: 2 }}>{c.sha}</div>
                  <div style={{ fontSize: 12, color: "#e8eaf0", marginBottom: 2 }}>{c.message}</div>
                  <div style={{ fontSize: 11, color: "#8899aa" }}>{c.author} · {new Date(c.date).toLocaleDateString()}</div>
                </Card>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8899aa", marginBottom: 8 }}>TOP CONTRIBUTORS</div>
              {result.top_contributors.map((c, i) => (
                <Card key={i} style={{ padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={c.avatar} alt={c.login} style={{ width: 32, height: 32, borderRadius: "50%" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0" }}>{c.login}</div>
                    <div style={{ fontSize: 11, color: "#8899aa" }}>{c.contributions} commits</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {trending.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899aa", marginBottom: 8 }}>🔥 TRENDING PYTHON REPOS THIS WEEK</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {trending.map((r, i) => (
              <Card key={i} style={{ padding: "12px 16px" }}
                onClick={() => setForm({ ...form, owner: r.name.split("/")[0], repo: r.name.split("/")[1] })}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#7c8cf8" }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: "#e0a033" }}>⭐ {r.stars.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: "#8899aa" }}>{r.description || "No description"}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MASTODON PANEL ───────────────────────────────────────────────────────────
function MastodonPanel() {
  const [form, setForm]     = useState({ instance_url: "https://mastodon.social", access_token: "", hashtag: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const loadDemo = async () => {
    setLoading(true); setError("");
    try { setResult(await api("/mastodon/demo-trends")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const analyse = async () => {
    if (!form.access_token.trim()) { setError("Access token is required for live analysis."); return; }
    setLoading(true); setError(""); setResult(null);
    try { setResult(await api("/mastodon/analyse", { method: "POST", body: JSON.stringify(form) })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <SectionHeader icon="mastodon" title="Mastodon Agent" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Instance URL" value={form.instance_url}
            onChange={e => setForm({ ...form, instance_url: e.target.value })}
            placeholder="https://mastodon.social" />
          <Input label="Access Token" type="password" value={form.access_token}
            onChange={e => setForm({ ...form, access_token: e.target.value })}
            placeholder="Your token..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
          <Input label="Hashtag filter (optional)" value={form.hashtag}
            onChange={e => setForm({ ...form, hashtag: e.target.value })} placeholder="python" />
          <Btn onClick={analyse} disabled={loading}>
            <Icon d={ICONS.refresh} size={14} /> Analyse Live
          </Btn>
          <Btn onClick={loadDemo} variant="ghost" disabled={loading}>Load Demo</Btn>
        </div>
      </Card>

      {error && <div style={{ color: "#e05252", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {result && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", marginBottom: 6 }}>🤖 AI SENTIMENT ANALYSIS</div>
            <div style={{ fontSize: 13, color: "#c8d0e8", lineHeight: 1.6, marginBottom: 12 }}>{result.sentiment_summary}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {result.trending_topics.map((t, i) => (
                <span key={i} style={{
                  background: `rgba(124,140,248,${Math.max(0.1, 0.35 - i * 0.03)})`,
                  color: "#e8eaf0", borderRadius: 20,
                  padding: "3px 12px", fontSize: 12, fontWeight: 600,
                }}>#{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8899aa", marginBottom: 8 }}>💡 AI RECOMMENDATIONS</div>
            {result.recommended_actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: "#c8d0e8" }}>
                <span style={{ color: "#7c8cf8" }}>→</span> {a}
              </div>
            ))}
          </Card>

          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899aa", marginBottom: 8 }}>RECENT POSTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.recent_posts.map((p, i) => (
              <Card key={i} style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#7c8cf8" }}>@{p.account}</span>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#8899aa" }}>
                    <span>🔁 {p.reblogs}</span><span>⭐ {p.favourites}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#c8d0e8", lineHeight: 1.5 }}>{p.content}</div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── PA CHAT PANEL ────────────────────────────────────────────────────────────
function ChatPanel() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hi! I'm your AI Personal Assistant, powered by Claude. I have live access to your tasks and calendar. Ask me anything — what to prioritise, how to use the platform, or just chat about your day.",
    },
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg    = { role: "user", content: input };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    try {
      const data = await api("/chat/message", {
        method: "POST",
        body: JSON.stringify({ message: input, history: messages }),
      });
      setMessages([...newHistory, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages([...newHistory, {
        role: "assistant",
        content: `⚠️ ${e.message || "Couldn't reach the chat agent. Make sure ANTHROPIC_API_KEY is set and the server is running."}`,
      }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      <SectionHeader icon="chat" title="PA Chat Assistant" />

      {/* Suggested prompts */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          "What should I work on next?",
          "How many tasks do I have?",
          "What's coming up in my schedule?",
          "How do I use the GitHub Agent?",
        ].map((prompt, i) => (
          <button key={i} onClick={() => setInput(prompt)} style={{
            background: "rgba(124,140,248,0.1)",
            border: "1px solid rgba(124,140,248,0.3)",
            borderRadius: 20, padding: "5px 14px",
            color: "#a0aaff", fontSize: 12, cursor: "pointer",
            fontFamily: "inherit",
          }}>
            {prompt}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(124,140,248,0.2)", border: "1px solid rgba(124,140,248,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginRight: 8, marginTop: 4, fontSize: 12,
              }}>🤖</div>
            )}
            <div style={{
              maxWidth: "72%",
              background: m.role === "user" ? "rgba(124,140,248,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${m.role === "user" ? "rgba(124,140,248,0.35)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "11px 16px", fontSize: 13, color: "#e0e4f0", lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(124,140,248,0.2)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 12,
            }}>🤖</div>
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "18px 18px 18px 4px", padding: "11px 16px",
              fontSize: 13, color: "#8899aa",
            }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask your PA anything... (Enter to send)"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, padding: "11px 16px",
            color: "#e8eaf0", fontSize: 14, outline: "none", fontFamily: "inherit",
          }}
        />
        <Btn onClick={send} disabled={loading || !input.trim()}>
          <Icon d={ICONS.send} size={14} /> Send
        </Btn>
      </div>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ onNav }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api("/status").then(setStatus).catch(() => {});
  }, []);

  const cards = [
    { label: "Total Tasks",  value: status?.total_tasks     ?? "—", color: "#7c8cf8", tab: "tasks" },
    { label: "Pending",      value: status?.pending_tasks   ?? "—", color: "#e0a033", tab: "tasks" },
    { label: "Completed",    value: status?.completed_tasks ?? "—", color: "#52b788", tab: "tasks" },
    { label: "Events",       value: status?.upcoming_events ?? "—", color: "#e05252", tab: "scheduler" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", color: "#e8eaf0" }}>
          Good day, Agent.
        </h1>
        <p style={{ margin: 0, color: "#8899aa", fontSize: 14 }}>Your Personal Assistant is standing by.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {cards.map(c => (
          <Card key={c.label} style={{ cursor: "pointer", borderColor: c.color + "33" }} onClick={() => onNav(c.tab)}>
            <div style={{ fontSize: 28, fontWeight: 900, color: c.color, marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#8899aa", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{c.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899aa", marginBottom: 12 }}>SERVICES</div>
          {[
            { name: "Task Manager",    desc: "Create, track & complete tasks",    icon: "tasks",    tab: "tasks",    color: "#7c8cf8" },
            { name: "Scheduler",       desc: "Events & calendar reminders",       icon: "calendar", tab: "scheduler",color: "#e0a033" },
            { name: "GitHub Agent",    desc: "AI vibe-code repos & see trends",   icon: "github",   tab: "github",   color: "#52b788" },
            { name: "Mastodon Agent",  desc: "AI feed analysis & trend mining",   icon: "mastodon", tab: "mastodon", color: "#e05252" },
            { name: "PA Chat",         desc: "Ask your AI assistant anything",    icon: "chat",     tab: "chat",     color: "#a78bfa" },
          ].map(s => (
            <div key={s.name} onClick={() => onNav(s.tab)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", cursor: "pointer",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ background: s.color + "22", borderRadius: 8, padding: 8, color: s.color, display: "flex" }}>
                <Icon d={ICONS[s.icon]} size={14} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#8899aa" }}>{s.desc}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "#8899aa", fontSize: 18 }}>›</span>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899aa", marginBottom: 12 }}>API ENDPOINTS</div>
          {[
            ["GET",  "/api/health"],
            ["GET",  "/api/status"],
            ["GET",  "/api/tasks/"],
            ["POST", "/api/tasks/"],
            ["GET",  "/api/scheduler/"],
            ["POST", "/api/scheduler/"],
            ["POST", "/api/github/analyse"],
            ["GET",  "/api/github/trending"],
            ["POST", "/api/mastodon/analyse"],
            ["GET",  "/api/mastodon/demo-trends"],
            ["POST", "/api/chat/message"],
          ].map(([method, path]) => (
            <div key={path} style={{ display: "flex", gap: 10, marginBottom: 6, fontSize: 12 }}>
              <span style={{ minWidth: 44, color: method === "GET" ? "#52b788" : "#e0a033", fontWeight: 700, fontSize: 11 }}>{method}</span>
              <code style={{ color: "#c8d0e8" }}>{path}</code>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── APP SHELL ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "alert"    },
  { id: "tasks",     label: "Tasks",     icon: "tasks"    },
  { id: "scheduler", label: "Scheduler", icon: "calendar" },
  { id: "github",    label: "GitHub",    icon: "github"   },
  { id: "mastodon",  label: "Mastodon",  icon: "mastodon" },
  { id: "chat",      label: "PA Chat",   icon: "chat"     },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div style={{
      minHeight: "100vh", background: "#0d1117", color: "#e8eaf0",
      fontFamily: "'Syne', 'DM Sans', system-ui, sans-serif",
      display: "flex",
    }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, minHeight: "100vh",
        background: "rgba(255,255,255,0.02)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        padding: "24px 0", display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.15em", color: "#7c8cf8", textTransform: "uppercase" }}>PA·as·a·Service</div>
          <div style={{ fontSize: 11, color: "#8899aa", marginTop: 2 }}>OpenClaw Platform v2</div>
        </div>
        <div style={{ padding: "16px 10px", flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, border: "none",
              background: tab === t.id ? "rgba(124,140,248,0.15)" : "transparent",
              color: tab === t.id ? "#7c8cf8" : "#8899aa",
              fontWeight: tab === t.id ? 700 : 500,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              marginBottom: 2, textAlign: "left", transition: "all 0.15s",
            }}>
              <Icon d={ICONS[t.icon]} size={15} />
              {t.label}
              {t.id === "chat" && (
                <span style={{
                  marginLeft: "auto", background: "rgba(167,139,250,0.2)",
                  color: "#a78bfa", fontSize: 9, fontWeight: 800,
                  padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em",
                }}>AI</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#556" }}>
          FastAPI · React · Claude AI
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: "32px 36px", maxWidth: 1100, overflowY: "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&display=swap" rel="stylesheet" />
        {tab === "dashboard" && <Dashboard onNav={setTab} />}
        {tab === "tasks"     && <TasksPanel />}
        {tab === "scheduler" && <SchedulerPanel />}
        {tab === "github"    && <GitHubPanel />}
        {tab === "mastodon"  && <MastodonPanel />}
        {tab === "chat"      && <ChatPanel />}
      </main>
    </div>
  );
}
