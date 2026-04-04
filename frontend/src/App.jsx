import { useState, useEffect, useCallback, useRef } from "react";

const BASE = "http://localhost:8000/api";
async function api(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" }, ...opts,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || r.statusText);
  }
  if (r.status === 204) return null;
  return r.json();
}

// ── Human-readable error messages (Heuristic 9) ──────────────────────────────
function friendlyError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("404")) return "Not found — double-check the details and try again.";
  if (msg.includes("403")) return "Access denied — you may need to provide an API token.";
  if (msg.includes("401")) return "Invalid credentials — check your access token.";
  if (msg.includes("429")) return "Too many requests — wait a moment and try again.";
  if (msg.includes("500") || msg.includes("API error")) return "AI service is temporarily unavailable — try again in a few seconds.";
  if (msg.includes("fetch")) return "Can't reach the server — make sure the backend is running.";
  if (msg.includes("GROQ")) return "AI service error — check your GROQ_API_KEY is set correctly.";
  return msg.length > 80 ? "Something went wrong — please try again." : msg;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  indigo: "#7c8cf8", green: "#52b788", amber: "#e0a033",
  red: "#e05252", purple: "#a78bfa", cyan: "#06b6d4",
  text: "#e8eaf0", muted: "#8899aa", faint: "#445566",
  card: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)",
  hover: "rgba(255,255,255,0.05)",
};
const PRIORITY_COLOR = { high: C.red, medium: C.amber, low: C.green };
const STATUS_COLOR   = { pending: C.indigo, in_progress: C.amber, done: C.green };
const RISK_COLOR     = { high: C.red, medium: C.amber, low: C.green };
const RISK_EMOJI     = { high: "🔴", medium: "🟡", low: "🟢" };

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  tasks:     "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  calendar:  "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  github:    "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22",
  mastodon:  "M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m4 4V7",
  chat:      "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  focus:     "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 6v4l3 3",
  reports:   "M18 20V10M12 20V4M6 20v-6",
  wallet:    "M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zm18 4H2M7 15h.01",
  plus:      "M12 5v14M5 12h14",
  trash:     "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  check:     "M20 6L9 17l-5-5",
  refresh:   "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  send:      "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  bell:      "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  filter:    "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  undo:      "M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13",
  x:         "M18 6L6 18M6 6l12 12",
  info:      "M12 16v-4M12 8h.01M12 2a10 10 0 100 20A10 10 0 0012 2z",
  budget:    "M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  news:     "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM9 13h6M9 17h4",
  sgflag:   "M12 2a10 10 0 100 20A10 10 0 0012 2zm-2 6h8M6 12h12M6 16h8",
  academic: "M12 2l9 4.9V11c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V6.9L12 2z",
};

// ── Toast system (Heuristic 1 — Visibility of system status) ──────────────────
const ToastContext = { listeners: [] };
function useToast() {
  return {
    show: (msg, type = "success") => {
      ToastContext.listeners.forEach(fn => fn({ msg, type, id: Date.now() }));
    }
  };
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const fn = (t) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    ToastContext.listeners.push(fn);
    return () => { ToastContext.listeners = ToastContext.listeners.filter(f => f !== fn); };
  }, []);

  const colors = { success: C.green, error: C.red, info: C.indigo };

  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 99999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: "#1a1e2e", border: `1px solid ${colors[t.type] || C.green}60`,
          borderLeft: `3px solid ${colors[t.type] || C.green}`,
          borderRadius: 8, padding: "10px 16px",
          fontSize: 13, color: C.text, maxWidth: 320,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          animation: "slideIn 0.2s ease",
        }}>
          {t.type === "success" && "✅ "}{t.type === "error" && "⚠️ "}{t.type === "info" && "ℹ️ "}
          {t.msg}
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }`}</style>
    </div>
  );
}

// ── Undo delete (Heuristic 3 — User control and freedom) ──────────────────────
function UndoBar({ message, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9998, background: "#1a1e2e",
      border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "10px 20px", display: "flex", alignItems: "center", gap: 16,
      fontSize: 13, color: C.text, boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    }}>
      <span>{message}</span>
      <button onClick={onUndo} style={{
        background: C.indigo, border: "none", borderRadius: 6,
        padding: "4px 12px", color: "#fff", fontSize: 12,
        fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}>Undo</button>
      <button onClick={onDismiss} style={{
        background: "transparent", border: "none", color: C.muted,
        cursor: "pointer", padding: 4,
      }}><Icon d={ICONS.x} size={14} /></button>
    </div>
  );
}

// ── Base components ───────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span style={{
      background: color + "20", color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: "2px 7px", fontSize: 10,
      fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "18px 20px",
      cursor: onClick ? "pointer" : undefined,
      transition: onClick ? "border-color 0.15s" : undefined, ...style,
    }}
      onMouseEnter={onClick ? e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)" : undefined}
      onMouseLeave={onClick ? e => e.currentTarget.style.borderColor = C.border : undefined}
    >{children}</div>
  );
}

function Stat({ label, value, color, onClick }) {
  return (
    <Card onClick={onClick} style={{ borderColor: color + "30", cursor: onClick ? "pointer" : undefined }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, marginBottom: 4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
    </Card>
  );
}

function Input({ label, tooltip, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</label>
          {tooltip && (
            <span title={tooltip} style={{ color: C.faint, cursor: "help", fontSize: 11 }}>
              <Icon d={ICONS.info} size={11} />
            </span>
          )}
        </div>
      )}
      <input style={{
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 13px", color: C.text, fontSize: 13,
        outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
      }}
        onFocus={e => e.target.style.borderColor = C.indigo + "80"}
        onBlur={e => e.target.style.borderColor = C.border}
        {...props}
      />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</label>}
      <select style={{
        background: "#0d1117", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "9px 13px", color: C.text,
        fontSize: 13, outline: "none", fontFamily: "inherit",
      }} {...props}>{children}</select>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", small, disabled }) {
  const styles = {
    primary: { background: C.indigo, color: "#fff" },
    ghost:   { background: "rgba(255,255,255,0.06)", color: C.muted },
    danger:  { background: "transparent", color: C.red, border: `1px solid ${C.red}30` },
    success: { background: C.green, color: "#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant], border: styles[variant].border || "none",
      borderRadius: 8, padding: small ? "5px 11px" : "9px 18px",
      fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      display: "flex", alignItems: "center", gap: 6,
      fontFamily: "inherit", transition: "opacity 0.15s", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none", borderRadius: 6,
      padding: "5px 7px", color: C.muted, cursor: "pointer",
      display: "flex", alignItems: "center", transition: "color 0.15s, background 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = C.red + "15"; }}
      onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent"; }}
    ><Icon d={ICONS.trash} size={14} /></button>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: subtitle ? 4 : 0 }}>
        <div style={{ background: "rgba(124,140,248,0.12)", borderRadius: 8, padding: 8, display: "flex", color: C.indigo }}>
          <Icon d={ICONS[icon]} size={15} />
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{title}</h2>
      </div>
      {subtitle && <p style={{ margin: "0 0 0 42px", fontSize: 13, color: C.muted }}>{subtitle}</p>}
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
      <div style={{ marginBottom: 12, opacity: 0.3 }}><Icon d={ICONS[icon]} size={32} color={C.muted} /></div>
      <div style={{ fontSize: 14 }}>{message}</div>
    </div>
  );
}

// Filter pill row (Heuristic 7 — Flexibility and efficiency)
function FilterPills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          background: value === o.value ? C.indigo + "25" : "transparent",
          border: `1px solid ${value === o.value ? C.indigo + "60" : C.border}`,
          borderRadius: 20, padding: "4px 14px", fontSize: 12,
          color: value === o.value ? C.indigo : C.muted,
          cursor: "pointer", fontFamily: "inherit", fontWeight: value === o.value ? 700 : 400,
          transition: "all 0.15s",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

// ── TASKS PANEL ───────────────────────────────────────────────────────────────
function TasksPanel() {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");
  const [form, setForm]       = useState({ title: "", description: "", priority: "medium", due_date: "" });
  const [error, setError]     = useState("");
  const [undoItem, setUndoItem] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setTasks(await api("/tasks/")); }
    catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim()) return;
    try {
      await api("/tasks/", { method: "POST", body: JSON.stringify({ ...form, due_date: form.due_date || null }) });
      setForm({ title: "", description: "", priority: "medium", due_date: "" });
      toast.show(`Task "${form.title}" created`);
      load();
    } catch (e) { setError(friendlyError(e)); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api(`/tasks/${id}/status?status=${status}`, { method: "PATCH" });
      const t = tasks.find(t => t.id === id);
      toast.show(status === "done" ? `"${t?.title}" marked as done! 🎉` : `"${t?.title}" started`);
      load();
    } catch (e) { setError(friendlyError(e)); }
  };

  // Undo delete (Heuristic 3)
  const deleteTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    try {
      await api(`/tasks/${id}`, { method: "DELETE" });
      setUndoItem({ type: "task", data: task });
      load();
    } catch (e) { setError(friendlyError(e)); }
  };

  const undoDelete = async () => {
    if (!undoItem) return;
    try {
      await api("/tasks/", { method: "POST", body: JSON.stringify(undoItem.data) });
      toast.show("Task restored");
      setUndoItem(null);
      load();
    } catch (e) { setError(friendlyError(e)); }
  };

  const isOverdue = (t) => t.due_date && t.status !== "done" && new Date(t.due_date) < new Date();

  const FILTERS = [
    { value: "all", label: `All (${tasks.length})` },
    { value: "pending", label: `Pending (${tasks.filter(t => t.status === "pending").length})` },
    { value: "in_progress", label: `In Progress (${tasks.filter(t => t.status === "in_progress").length})` },
    { value: "done", label: `Done (${tasks.filter(t => t.status === "done").length})` },
    { value: "overdue", label: `Overdue (${tasks.filter(isOverdue).length})` },
  ];

  const filtered = tasks.filter(t => {
    if (filter === "all") return true;
    if (filter === "overdue") return isOverdue(t);
    return t.status === filter;
  });

  const canAdd = form.title.trim().length > 0;

  return (
    <div>
      <SectionHeader icon="tasks" title="Task Manager" subtitle="Create, filter, and track your to-dos" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Task title" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="What needs to be done?"
            onKeyDown={e => e.key === "Enter" && canAdd && create()} />
          <Input label="Due date (optional)" type="date" value={form.due_date}
            onChange={e => setForm({ ...form, due_date: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
          <Input label="Description (optional)" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Any extra details..." />
          <Select label="Priority" value={form.priority}
            onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </Select>
          {/* Disabled when empty — Heuristic 5 */}
          <Btn onClick={create} disabled={!canAdd}>
            <Icon d={ICONS.plus} size={14} /> Add task
          </Btn>
        </div>
        {!canAdd && form.title === "" && (
          <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>
            Enter a task title to enable the Add button
          </div>
        )}
      </Card>

      {error && <div style={{ color: C.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Filter pills — Heuristic 7 */}
      <FilterPills options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <EmptyState icon="tasks" message="Loading tasks..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="tasks" message={filter === "all" ? "No tasks yet — add one above!" : `No ${filter.replace("_", " ")} tasks`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(t => (
            <Card key={t.id} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              borderColor: isOverdue(t) ? C.red + "30" : C.border,
              opacity: t.status === "done" ? 0.65 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.text, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
                  <Badge label={t.priority} color={PRIORITY_COLOR[t.priority]} />
                  <Badge label={t.status.replace("_", " ")} color={STATUS_COLOR[t.status]} />
                  {isOverdue(t) && <Badge label="overdue" color={C.red} />}
                </div>
                {t.description && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{t.description}</div>}
                {t.due_date && (
                  <div style={{ fontSize: 11, color: isOverdue(t) ? C.red : C.faint }}>📅 Due {t.due_date}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                {t.status === "pending" && <Btn small variant="ghost" onClick={() => updateStatus(t.id, "in_progress")}>Start</Btn>}
                {t.status === "in_progress" && (
                  <Btn small onClick={() => updateStatus(t.id, "done")}>
                    <Icon d={ICONS.check} size={12} /> Done
                  </Btn>
                )}
                <DeleteBtn onClick={() => deleteTask(t.id)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {undoItem && (
        <UndoBar
          message={`"${undoItem.data.title}" deleted`}
          onUndo={undoDelete}
          onDismiss={() => setUndoItem(null)}
        />
      )}
    </div>
  );
}

// ── SCHEDULER PANEL ───────────────────────────────────────────────────────────
function SchedulerPanel() {
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState({ title: "", datetime_iso: "", description: "", reminder_minutes: 30 });
  const [error, setError]       = useState("");
  const [undoItem, setUndoItem] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try { setEvents(await api("/scheduler/")); }
    catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim() || !form.datetime_iso) return;
    const dt = new Date(form.datetime_iso);
    if (dt < new Date()) {
      setError("That date is in the past — please pick a future date and time.");
      return;
    }
    setError("");
    try {
      await api("/scheduler/", { method: "POST", body: JSON.stringify(form) });
      setForm({ title: "", datetime_iso: "", description: "", reminder_minutes: 30 });
      toast.show(`"${form.title}" scheduled`);
      load();
    } catch (e) { setError(friendlyError(e)); }
  };

  const deleteEvent = async (id) => {
    const ev = events.find(e => e.id === id);
    try {
      await api(`/scheduler/${id}`, { method: "DELETE" });
      setUndoItem({ type: "event", data: ev });
      load();
    } catch (e) { setError(friendlyError(e)); }
  };

  const undoDelete = async () => {
    if (!undoItem) return;
    try {
      await api("/scheduler/", { method: "POST", body: JSON.stringify(undoItem.data) });
      toast.show("Event restored");
      setUndoItem(null);
      load();
    } catch (e) { setError(friendlyError(e)); }
  };

  const formatDate = (iso) => new Date(iso).toLocaleString([], {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const isPast = (iso) => new Date(iso) < new Date();
  const canAdd = form.title.trim() && form.datetime_iso;

  return (
    <div>
      <SectionHeader icon="calendar" title="Scheduler" subtitle="Schedule events and set reminders" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Event title" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Team standup, study session..." />
          <Input label="Date & time" type="datetime-local" value={form.datetime_iso}
            onChange={e => setForm({ ...form, datetime_iso: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
          <Input label="Description (optional)" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What's this about?" />
          <Select label="Reminder" value={form.reminder_minutes}
            onChange={e => setForm({ ...form, reminder_minutes: Number(e.target.value) })}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
          </Select>
          <Btn onClick={create} disabled={!canAdd}><Icon d={ICONS.plus} size={14} /> Add event</Btn>
        </div>
        {!canAdd && <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>Enter a title and date to enable Add</div>}
      </Card>

      {error && <div style={{ color: C.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {loading ? <EmptyState icon="calendar" message="Loading events..." />
        : events.length === 0 ? <EmptyState icon="calendar" message="No events yet — schedule something above!" />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map(e => (
              <Card key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, opacity: isPast(e.datetime_iso) ? 0.5 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>{e.title}</div>
                  <div style={{ fontSize: 13, color: C.indigo, marginBottom: e.description ? 4 : 0 }}>
                    📅 {formatDate(e.datetime_iso)}
                    {isPast(e.datetime_iso) && <span style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>(past)</span>}
                  </div>
                  {e.description && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{e.description}</div>}
                  <div style={{ fontSize: 11, color: C.faint }}>🔔 Reminder {e.reminder_minutes} min before</div>
                </div>
                <DeleteBtn onClick={() => deleteEvent(e.id)} />
              </Card>
            ))}
          </div>
        )}

      {undoItem && <UndoBar message={`"${undoItem.data.title}" deleted`} onUndo={undoDelete} onDismiss={() => setUndoItem(null)} />}
    </div>
  );
}

// ── GITHUB PANEL ──────────────────────────────────────────────────────────────
function GitHubPanel() {
  const [form, setForm]         = useState({ owner: "anthropics", repo: "anthropic-sdk-python", token: "" });
  const [result, setResult]     = useState(null);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const toast = useToast();

  useEffect(() => { api("/github/trending").then(setTrending).catch(() => {}); }, []);

  const analyse = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      setResult(await api("/github/analyse", { method: "POST", body: JSON.stringify(form) }));
      toast.show(`Analysis complete for ${form.owner}/${form.repo}`);
    } catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  };

  const canAnalyse = form.owner.trim() && form.repo.trim();

  return (
    <div>
      <SectionHeader icon="github" title="GitHub Agent" subtitle="AI-powered repository analysis and trending repos" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Owner" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="anthropics" />
          <Input label="Repository" value={form.repo} onChange={e => setForm({ ...form, repo: e.target.value })} placeholder="anthropic-sdk-python" />
          <Input label="Token (optional)" tooltip="A GitHub personal access token increases rate limits from 60 to 5,000 requests/hour" value={form.token} type="password" onChange={e => setForm({ ...form, token: e.target.value })} placeholder="ghp_..." />
        </div>
        <Btn onClick={analyse} disabled={loading || !canAnalyse}>
          {loading ? "Analysing..." : <><Icon d={ICONS.refresh} size={14} /> Analyse repo</>}
        </Btn>
      </Card>

      {error && (
        <div style={{ color: C.red, marginBottom: 12, fontSize: 13, padding: "10px 14px", background: C.red + "10", borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
          {error}
          {error.includes("token") && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Get a free token at github.com → Settings → Developer settings → Personal access tokens</div>}
        </div>
      )}

      {result && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              {[
                { v: result.stars.toLocaleString(), l: "Stars",       c: C.indigo },
                { v: result.forks.toLocaleString(), l: "Forks",       c: C.green  },
                { v: result.open_issues,             l: "Open issues", c: C.amber  },
              ].map(({ v, l, c }) => (
                <div key={l}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
                </div>
              ))}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{result.repo}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{result.description}</div>
                <Badge label={result.language} color={C.indigo} />
              </div>
            </div>
            <div style={{ background: "rgba(124,140,248,0.07)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#c8d0e8", lineHeight: 1.7, borderLeft: `3px solid ${C.indigo}` }}>
              {result.vibe_summary}
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: "0.05em" }}>Recent commits</div>
              {result.recent_commits.slice(0, 5).map((c, i) => (
                <Card key={i} style={{ padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: C.indigo, marginBottom: 2 }}>{c.sha}</div>
                  <div style={{ fontSize: 12, color: C.text, marginBottom: 2 }}>{c.message}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{c.author} · {new Date(c.date).toLocaleDateString()}</div>
                </Card>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: "0.05em" }}>Top contributors</div>
              {result.top_contributors.map((c, i) => (
                <Card key={i} style={{ padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={c.avatar} alt={c.login} style={{ width: 30, height: 30, borderRadius: "50%" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.login}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{c.contributions} commits</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {trending.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: "0.05em" }}>🔥 Trending Python repos this week</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {trending.map((r, i) => (
              <Card key={i} style={{ padding: "12px 16px", cursor: "pointer" }}
                onClick={() => { setForm({ ...form, owner: r.name.split("/")[0], repo: r.name.split("/")[1] }); toast.show(`Loaded ${r.name}`, "info"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.indigo }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: C.amber }}>⭐ {r.stars.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>{r.description || "No description"}</div>
                <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>Click to analyse →</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MASTODON PANEL ────────────────────────────────────────────────────────────
function MastodonPanel({ riskLevel }) {
  const [form, setForm] = useState({ instance_url: "https://mastodon.social", access_token: "", hashtag: "" });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showWarning, setShowWarning] = useState(riskLevel === "high");
  const toast = useToast();

  if (showWarning) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Card style={{ maxWidth: 400, textAlign: "center", borderColor: C.red + "40" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.red, marginBottom: 8 }}>Heads up</div>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 24 }}>
            You have a <strong style={{ color: C.red }}>high procrastination risk</strong>. Research shows checking social media when you have overdue tasks makes it significantly harder to refocus.
          </p>
          <Btn variant="danger" onClick={() => setShowWarning(false)}>Open Mastodon anyway</Btn>
        </Card>
      </div>
    );
  }

  const loadDemo = async () => {
    setLoading(true); setError("");
    try { setResult(await api("/mastodon/demo-trends")); toast.show("Demo loaded", "info"); }
    catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  };

  const analyse = async () => {
    if (!form.access_token.trim()) { setError("An access token is required for live analysis. Use 'Load demo' to see a preview without credentials."); return; }
    setLoading(true); setError(""); setResult(null);
    try { setResult(await api("/mastodon/analyse", { method: "POST", body: JSON.stringify(form) })); toast.show("Feed analysed"); }
    catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <SectionHeader icon="mastodon" title="Mastodon Agent" subtitle="AI social feed analysis and trend mining" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Input label="Instance URL" value={form.instance_url} onChange={e => setForm({ ...form, instance_url: e.target.value })} />
          <Input label="Access token" tooltip="Get from Mastodon: Settings → Development → New application"
            type="password" value={form.access_token}
            onChange={e => setForm({ ...form, access_token: e.target.value })}
            placeholder="Your token..." />
        </div>
        <div style={{ fontSize:11, color:C.faint, marginTop:8 }}>
          💡 Leave token empty to use your .env configured account, or enter a token manually
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
          <Input label="Hashtag filter (optional)" value={form.hashtag} onChange={e => setForm({ ...form, hashtag: e.target.value })} placeholder="python, ai, tech..." />
          <Btn onClick={analyse} disabled={loading}><Icon d={ICONS.refresh} size={14} /> Analyse live</Btn>
          <Btn onClick={loadDemo} variant="ghost" disabled={loading}>Load demo</Btn>
        </div>
      </Card>

      {error && <div style={{ color: C.red, marginBottom: 12, fontSize: 13, padding: "10px 14px", background: C.red + "10", borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>{error}</div>}

      {result && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: "#c8d0e8", lineHeight: 1.7, marginBottom: 14 }}>{result.sentiment_summary}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {result.trending_topics.slice(0, 6).map((t, i) => (
                <span key={i} style={{ background: `rgba(124,140,248,${Math.max(0.08, 0.25 - i * 0.03)})`, color: C.text, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>#{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10, letterSpacing: "0.05em" }}>AI recommendations</div>
            {result.recommended_actions.slice(0, 4).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 13, color: "#c8d0e8" }}>
                <span style={{ color: C.indigo, flexShrink: 0 }}>→</span> {a}
              </div>
            ))}
          </Card>

          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: "0.05em" }}>Recent posts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.recent_posts.map((p, i) => (
              <Card key={i} style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.indigo }}>@{p.account}</span>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.muted }}>
                    <span>🔁 {p.reblogs}</span><span>⭐ {p.favourites}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#c8d0e8", lineHeight: 1.5 }}>{p.content}</div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                  @{p.account.split("@")[1] || "mastodon.social"}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── PA CHAT PANEL ─────────────────────────────────────────────────────────────
function ChatPanel() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "👋 Hi! I'm your AI Personal Assistant. I have live access to your tasks, calendar, and finances — and I can take action for you.\n\nTry saying:\n• \"Add $8 food for lunch\"\n• \"Create a high priority task called Study for finals\"\n• \"Schedule a meeting tomorrow at 3pm\"\n• \"What should I work on next?\"",
  }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const toast = useToast();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
      if (data.reply.includes("✅")) toast.show("Action completed!", "success");
    } catch (e) {
      setMessages([...newHistory, { role: "assistant", content: `⚠️ ${friendlyError(e)}` }]);
    }
    setLoading(false);
  };

  const PROMPTS = [
    "What should I work on next?",
    "Add $5 transport for MRT",
    "Create task: Write report, high priority",
    "How do I use Focus Mode?",
    "What's my spending this week?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      <SectionHeader icon="chat" title="PA Chat Assistant" subtitle="Ask anything or give commands — I can create tasks, log expenses, and schedule events" />

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {PROMPTS.map((p, i) => (
          <button key={i} onClick={() => setInput(p)} style={{
            background: "rgba(124,140,248,0.08)", border: `1px solid rgba(124,140,248,0.25)`,
            borderRadius: 20, padding: "5px 14px", color: "#a0aaff",
            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>{p}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(124,140,248,0.15)", border: `1px solid rgba(124,140,248,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 4, fontSize: 13 }}>🤖</div>
            )}
            <div style={{
              maxWidth: "72%",
              background: m.role === "user" ? "rgba(124,140,248,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${m.role === "user" ? "rgba(124,140,248,0.3)" : C.border}`,
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "11px 15px", fontSize: 13, color: "#e0e4f0", lineHeight: 1.65, whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(124,140,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🤖</div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: "18px 18px 18px 4px", padding: "11px 15px", fontSize: 13, color: C.muted }}>Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder='Try "Add $8 food for lunch" or "Create task: Study for finals"'
          style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 15px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
        />
        <Btn onClick={send} disabled={loading || !input.trim()}>
          <Icon d={ICONS.send} size={14} /> Send
        </Btn>
      </div>
    </div>
  );
}

// ── FOCUS MODE PANEL ──────────────────────────────────────────────────────────
function ProcrastinationPanel() {
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode]       = useState("work");
  const [focusTask, setFocusTask]       = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [phase, setPhase]               = useState("idle");
  const timerRef                        = useRef(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/procrastination/analyse");
      setData(d);
      if (d.nudge?.one_task && !focusTask) setFocusTask(d.nudge.one_task);
    } catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            setTimerRunning(false);
            if (timerMode === "work") {
              setSessionCount(c => c + 1);
              setPhase("break");
              setTimerMode("break");
              setTimerSeconds(5 * 60);
              toast.show("🍅 Session complete! Take a 5-min break.", "success");
            } else {
              setPhase("idle");
              setTimerMode("work");
              setTimerSeconds(25 * 60);
              toast.show("Break over — ready for the next session!", "info");
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, timerMode]);

  const startSession = (task) => {
    if (task) setFocusTask(task);
    setTimerMode("work"); setTimerSeconds(25 * 60);
    setTimerRunning(true); setPhase("working");
    toast.show(`Starting focus session on "${task || focusTask}"`, "info");
  };

  const resetTimer = () => {
    clearInterval(timerRef.current);
    setTimerRunning(false); setTimerMode("work");
    setTimerSeconds(25 * 60); setPhase("idle");
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const timerPct   = timerMode === "work" ? ((25*60-timerSeconds)/(25*60))*100 : ((5*60-timerSeconds)/(5*60))*100;
  const timerColor = timerMode === "work" ? C.indigo : C.green;

  const urgentTasks = data ? [...(data.overdue||[]), ...(data.pending_high||[])]
    .filter((t,i,arr) => arr.findIndex(x=>x.id===t.id)===i).slice(0,4) : [];

  const TimerCircle = ({ size=220 }) => {
    const r = size/2-12, circ = 2*Math.PI*r;
    return (
      <div style={{ position:"relative", width:size, height:size }}>
        <svg width={size} height={size} style={{ position:"absolute", top:0, left:0, transform:"rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={timerColor} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={circ*(1-timerPct/100)}
            strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s linear" }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:size>200?44:32, fontWeight:900, color:C.text, fontFamily:"monospace", letterSpacing:"-1px", lineHeight:1 }}>{formatTime(timerSeconds)}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{timerRunning?(timerMode==="work"?"stay focused":"take a rest"):"ready"}</div>
        </div>
      </div>
    );
  };

  if (phase === "working") return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"70vh", gap:28 }}>
      <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.12em", textTransform:"uppercase" }}>Focus session {sessionCount+1} {"🍅".repeat(Math.min(sessionCount+1,5))}</div>
      <TimerCircle size={240} />
      <div style={{ background:"rgba(124,140,248,0.08)", border:`1px solid rgba(124,140,248,0.25)`, borderRadius:999, padding:"10px 28px", fontSize:14, fontWeight:700, color:C.text, maxWidth:360, textAlign:"center" }}>{focusTask}</div>
      <div style={{ display:"flex", gap:10 }}>
        {timerRunning ? <Btn variant="ghost" onClick={()=>setTimerRunning(false)}>⏸ Pause</Btn> : <Btn onClick={()=>setTimerRunning(true)}>▶ Resume</Btn>}
        <Btn variant="danger" small onClick={resetTimer}>✕ End session</Btn>
      </div>
      {sessionCount>0 && <div style={{ fontSize:12, color:C.faint }}>{"🍅".repeat(Math.min(sessionCount,8))} {sessionCount} completed today</div>}
    </div>
  );

  if (phase === "break") return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"70vh", gap:28 }}>
      <div style={{ fontSize:13, color:C.green, letterSpacing:"0.1em", textTransform:"uppercase" }}>☕ Break time — great work!</div>
      <TimerCircle size={240} />
      <div style={{ fontSize:14, color:C.muted, textAlign:"center", maxWidth:280, lineHeight:1.7 }}>Step away. Stretch, drink water, rest your eyes.</div>
      <div style={{ display:"flex", gap:10 }}>
        {timerRunning ? <Btn variant="ghost" onClick={()=>setTimerRunning(false)}>⏸ Pause</Btn> : <Btn variant="ghost" onClick={()=>setTimerRunning(true)}>▶ Resume break</Btn>}
        <Btn onClick={()=>{setPhase("idle");setTimerMode("work");setTimerSeconds(25*60);setTimerRunning(false);}}>Next session →</Btn>
      </div>
      <div style={{ fontSize:12, color:C.faint }}>{"🍅".repeat(Math.min(sessionCount,8))} {sessionCount} session{sessionCount!==1?"s":""} done</div>
    </div>
  );

  return (
    <div>
      <SectionHeader icon="focus" title="Focus Mode" subtitle="Pomodoro timer with AI anti-procrastination coaching — powered by Implementation Intentions (Gollwitzer, 1999)" />
      {loading ? <EmptyState icon="focus" message="Analysing your patterns..." />
      : error ? <div style={{ color:C.red, fontSize:13, padding:"10px 14px", background:C.red+"10", borderRadius:8 }}>{error}</div>
      : data && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, padding:"12px 16px", background:C.card, borderRadius:10, border:`1px solid ${RISK_COLOR[data.risk_level]}30` }}>
            <span style={{ fontSize:18 }}>{RISK_EMOJI[data.risk_level]}</span>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:13, fontWeight:700, color:RISK_COLOR[data.risk_level] }}>
                {data.risk_level.charAt(0).toUpperCase()+data.risk_level.slice(1)} procrastination risk
              </span>
              <span style={{ fontSize:13, color:C.muted, marginLeft:10 }}>
                {data.completion_rate}% complete · {data.overdue.length} overdue · {"🍅".repeat(Math.min(sessionCount,5))} {sessionCount} sessions today
              </span>
            </div>
            <button onClick={load} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer" }}><Icon d={ICONS.refresh} size={14} /></button>
          </div>

          {data.nudge?.one_task ? (
            <Card style={{ marginBottom:14, borderColor:C.indigo+"40", padding:"22px 24px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.indigo, marginBottom:8, letterSpacing:"0.08em" }}>🎯 START HERE</div>
              <div style={{ fontSize:19, fontWeight:800, color:C.text, marginBottom:6 }}>{data.nudge.one_task}</div>
              {data.nudge.mini_steps?.[0] && <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>First step: {data.nudge.mini_steps[0]}</div>}
              <Btn onClick={()=>startSession(data.nudge.one_task)}>▶ Start 25-min focus session</Btn>
              {data.nudge.implementation && <div style={{ marginTop:14, fontSize:12, color:C.faint, fontStyle:"italic" }}>"{data.nudge.implementation}"</div>}
            </Card>
          ) : (
            <Card style={{ marginBottom:14, borderColor:C.green+"40", padding:"22px 24px", textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:700, color:C.green, marginBottom:6 }}>You're on track!</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>No overdue tasks. Use a Pomodoro to get ahead.</div>
              <Btn onClick={()=>startSession("Free study / work session")}>▶ Start a focus session</Btn>
            </Card>
          )}

          {urgentTasks.length>0 && (
            <Card style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:12, letterSpacing:"0.05em" }}>⚡ Urgent tasks</div>
              {urgentTasks.map((t,i) => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom:i<urgentTasks.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{t.title}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                      {t.due_date&&`📅 ${t.due_date}`}
                      {t.days_overdue>0&&<span style={{ color:C.red }}> · {t.days_overdue}d overdue</span>}
                    </div>
                  </div>
                  <Btn small variant="ghost" onClick={()=>startSession(t.title)}>▶ Focus</Btn>
                </div>
              ))}
            </Card>
          )}

          {data.nudge?.encouragement && <div style={{ fontSize:13, color:C.faint, textAlign:"center", lineHeight:1.7, padding:"0 40px" }}>💜 {data.nudge.encouragement}</div>}
          <div style={{ fontSize:11, color:"#334455", textAlign:"center", marginTop:10 }}>Pomodoro Technique (Cirillo) · Implementation Intentions (Gollwitzer, 1999) · Self-Compassion (Sirois, Durham)</div>
        </>
      )}
    </div>
  );
}

// ── REPORTS PANEL ─────────────────────────────────────────────────────────────
function ReportsPanel() {
  const [tasks, setTasks]           = useState([]);
  const [briefing, setBriefing]     = useState("");
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [loading, setLoading]       = useState(true);
  const chartsRef                   = useRef({});
  const toast = useToast();

  useEffect(() => {
    api("/tasks/").then(t=>{setTasks(t);setLoading(false);}).catch(()=>setLoading(false));

  }, []);

  useEffect(() => {
    if (loading||tasks.length===0) return;
    Object.values(chartsRef.current).forEach(c=>c?.destroy());
    chartsRef.current={};
    const pending=tasks.filter(t=>t.status==="pending").length;
    const inProgress=tasks.filter(t=>t.status==="in_progress").length;
    const done=tasks.filter(t=>t.status==="done").length;
    const high=tasks.filter(t=>t.priority==="high").length;
    const medium=tasks.filter(t=>t.priority==="medium").length;
    const low=tasks.filter(t=>t.priority==="low").length;
    const overdue=tasks.filter(t=>t.due_date&&t.status!=="done"&&new Date(t.due_date)<new Date()).length;
    const onTrack=tasks.filter(t=>t.status!=="done"&&(!t.due_date||new Date(t.due_date)>=new Date())).length;
    const Chart=window.Chart; if(!Chart) return;
    const ctx1=document.getElementById("statusChart");
    if(ctx1) chartsRef.current.status=new Chart(ctx1,{type:"doughnut",data:{labels:["Pending","In Progress","Done"],datasets:[{data:[pending,inProgress,done],backgroundColor:[C.indigo,C.amber,C.green],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:"72%"}});
    const ctx2=document.getElementById("priorityChart");
    if(ctx2) chartsRef.current.priority=new Chart(ctx2,{type:"bar",data:{labels:["High","Medium","Low"],datasets:[{data:[high,medium,low],backgroundColor:[C.red,C.amber,C.green],borderRadius:6,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:C.muted}},y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:C.muted,stepSize:1}}}}});
    const ctx3=document.getElementById("overdueChart");
    if(ctx3) chartsRef.current.overdue=new Chart(ctx3,{type:"bar",data:{labels:["On track","Overdue"],datasets:[{data:[onTrack,overdue],backgroundColor:[C.green,C.red],borderRadius:6,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:C.muted}},y:{grid:{color:"rgba(255,255,255,0.04)"},ticks:{color:C.muted,stepSize:1}}}}});
  }, [loading,tasks]);

  const done=tasks.filter(t=>t.status==="done").length;
  const total=tasks.length;
  const completionPct=total>0?Math.round((done/total)*100):0;
  const overdue=tasks.filter(t=>t.due_date&&t.status!=="done"&&new Date(t.due_date)<new Date()).length;
  const barColor=completionPct>=50?C.green:completionPct>=25?C.amber:C.red;

  const getDailyBriefing = async () => {
    setLoadingBriefing(true);
    const pending  = tasks.filter(t => t.status === "pending");
    const overdueT = tasks.filter(t => t.due_date && t.status !== "done" && new Date(t.due_date) < new Date());
    const hour     = new Date().getHours();
    const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    try {
      const data = await api("/chat/message", {
        method: "POST",
        body: JSON.stringify({
          message: `Give me a concise ${greeting} briefing. I have ${pending.length} pending tasks, ${overdueT.length} overdue (${overdueT.map(t=>t.title).slice(0,2).join(", ") || "none"}), and ${tasks.filter(t=>t.status==="done").length} completed out of ${tasks.length} total. Max 3 sentences, warm and actionable.`,
          history: [],
        }),
      });
      setBriefing(data.reply);
      toast.show("Daily briefing generated");
    } catch(e) { setBriefing(friendlyError(e)); }
    setLoadingBriefing(false);
  };

  return (
    <div>
      <SectionHeader icon="reports" title="Reports & Daily Briefing" subtitle="Visual productivity insights and your AI morning brief" />
      {/* Daily briefing */}
      <Card style={{ marginBottom:14, borderColor:C.indigo+"30" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:briefing?14:0 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.text }}>AI Daily Briefing</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Personalised summary of your productivity</div>
          </div>
          <Btn onClick={getDailyBriefing} disabled={loadingBriefing}>
            {loadingBriefing ? "Generating..." : "✨ Get briefing"}
          </Btn>
        </div>
        {briefing && (
          <div style={{ background:"rgba(124,140,248,0.07)", borderRadius:8, padding:"12px 16px",
            fontSize:13, color:"#c8d0e8", lineHeight:1.7, borderLeft:`3px solid ${C.indigo}` }}>
            {briefing}
          </div>
        )}
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
        <Stat label="Total tasks"     value={total}              color={C.indigo} />
        <Stat label="Completion rate" value={`${completionPct}%`} color={barColor} />
        <Stat label="Overdue"         value={overdue}            color={overdue>0?C.red:C.green} />
        <Stat label="Completed"       value={done}               color={C.green} />
      </div>

      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:10, letterSpacing:"0.05em" }}>Overall completion</div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <div style={{ flex:1, background:"rgba(255,255,255,0.05)", borderRadius:999, height:10, overflow:"hidden" }}>
            <div style={{ width:`${completionPct}%`, height:"100%", borderRadius:999, background:barColor, transition:"width 0.5s ease" }} />
          </div>
          <span style={{ fontSize:15, fontWeight:900, color:C.text, minWidth:40 }}>{completionPct}%</span>
        </div>
        <div style={{ display:"flex", gap:16 }}>
          {[{l:"Pending",n:tasks.filter(t=>t.status==="pending").length,c:C.indigo},{l:"In progress",n:tasks.filter(t=>t.status==="in_progress").length,c:C.amber},{l:"Done",n:done,c:C.green}].map(s=>(
            <div key={s.l} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:s.c, flexShrink:0 }} />
              <span style={{ fontSize:12, color:C.muted }}>{s.l}: <strong style={{ color:C.text }}>{s.n}</strong></span>
            </div>
          ))}
        </div>
      </Card>

      {loading ? <EmptyState icon="reports" message="Loading charts..." /> : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          {[{id:"statusChart",title:"By status",legend:[["Pending",C.indigo],["In progress",C.amber],["Done",C.green]]},
            {id:"priorityChart",title:"By priority"},
            {id:"overdueChart",title:"Overdue vs on track"}].map(c=>(
            <Card key={c.id}>
              <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:10, letterSpacing:"0.05em" }}>{c.title}</div>
              <div style={{ position:"relative", height:180 }}><canvas id={c.id} /></div>
              {c.legend && (
                <div style={{ display:"flex", justifyContent:"center", gap:12, marginTop:10 }}>
                  {c.legend.map(([l,col])=>(
                    <div key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:C.muted }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:col }} />{l}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
const CAT_COLORS = { Food:"#e0a033",Transport:"#7c8cf8",Study:"#06b6d4",Entertainment:"#a78bfa",Shopping:"#e05252",Health:"#52b788",Utilities:"#8899aa",Other:"#445566" };
const CAT_EMOJI  = { Food:"🍜",Transport:"🚌",Study:"📚",Entertainment:"🎮",Shopping:"🛍️",Health:"🏥",Utilities:"💡",Other:"📦" };
// ── FINANCE PANEL ─────────────────────────────────────────────────────────────
function FinancePanel() {
  const [expenses, setExpenses]     = useState([]);
  const [summary, setSummary]       = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState({ amount: "", category: "Food", description: "", date: "" });
  const [budget, setBudget]         = useState(localStorage.getItem("pa_budget") || "");
  const [showBudget, setShowBudget] = useState(false);
  const [error, setError]           = useState("");
  const [undoItem, setUndoItem]     = useState(null);
  const chartRef                    = useRef(null);
  const chartInstance               = useRef(null);
  const toast = useToast();


  const load = useCallback(async () => {
    try {
      const [exp,sum,cats] = await Promise.all([api("/finance/"),api("/finance/summary"),api("/finance/categories")]);
      setExpenses(exp); setSummary(sum); setCategories(cats);
    } catch(e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!summary||!window.Chart||!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const cats=Object.keys(summary.by_category);
    const vals=Object.values(summary.by_category);
    const colors=cats.map(c=>CAT_COLORS[c]||C.muted);
    chartInstance.current=new window.Chart(chartRef.current,{type:"doughnut",data:{labels:cats,datasets:[{data:vals,backgroundColor:colors,borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:"68%"}});
  }, [summary]);

  const addExpense = async () => {
    if (!form.amount||isNaN(form.amount)||Number(form.amount)<=0) { setError("Please enter a valid amount greater than 0."); return; }
    setError("");
    try {
      await api("/finance/",{method:"POST",body:JSON.stringify({...form,amount:Number(form.amount),date:form.date||new Date().toISOString().split("T")[0]})});
      toast.show(`S$${Number(form.amount).toFixed(2)} logged under ${form.category}`);
      setForm({amount:"",category:"Food",description:"",date:""});
      load();
    } catch(e) { setError(friendlyError(e)); }
  };

  const deleteExpense = async (id) => {
    const exp=expenses.find(e=>e.id===id);
    try {
      await api(`/finance/${id}`,{method:"DELETE"});
      setUndoItem({type:"expense",data:exp});
      load();
    } catch(e) { setError(friendlyError(e)); }
  };

  const undoDelete = async () => {
    if (!undoItem) return;
    try {
      await api("/finance/",{method:"POST",body:JSON.stringify(undoItem.data)});
      toast.show("Expense restored");
      setUndoItem(null); load();
    } catch(e) { setError(friendlyError(e)); }
  };

  const saveBudget = (val) => {
    setBudget(val);
    localStorage.setItem("pa_budget", val);
    if (val) toast.show(`Monthly budget set to S$${Number(val).toFixed(2)}`);
  };

  const budgetNum   = Number(budget) || 0;
  const monthSpent  = summary?.total_month || 0;
  const budgetPct   = budgetNum > 0 ? Math.min((monthSpent / budgetNum) * 100, 100) : 0;
  const budgetColor = budgetPct >= 90 ? C.red : budgetPct >= 70 ? C.amber : C.green;
  const canAdd      = form.amount && Number(form.amount) > 0;

  return (
    <div>
      <SectionHeader icon="wallet" title="Finance Tracker" subtitle="Log expenses, spot patterns, get AI spending insights" />

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"140px 1fr 1fr", gap:10, marginBottom:10 }}>
          <Input label="Amount (S$)" value={form.amount} type="number" min="0.01" step="0.01"
            onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"
            onKeyDown={e=>e.key==="Enter"&&canAdd&&addExpense()} />
          <Select label="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
            {categories.map(c=><option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>)}
          </Select>
          <Input label="Description (optional)" value={form.description}
            onChange={e=>setForm({...form,description:e.target.value})} placeholder="Lunch, MRT, textbook..." />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:10, alignItems:"end" }}>
          <Input label="Date (optional — defaults to today)" type="date" value={form.date}
            onChange={e=>setForm({...form,date:e.target.value})} />
          <Btn onClick={addExpense} disabled={!canAdd}><Icon d={ICONS.plus} size={14} /> Log expense</Btn>
          <Btn variant="ghost" onClick={()=>setShowBudget(!showBudget)} small><Icon d={ICONS.budget} size={13} /> Budget</Btn>
        </div>
        {!canAdd && <div style={{ fontSize:11, color:C.faint, marginTop:8 }}>Enter an amount to enable Log button</div>}

        {/* Budget setter — Heuristic 2: real world context */}
        {showBudget && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"end", gap:10 }}>
            <Input label="Monthly budget (S$)" type="number" min="0" step="10"
              value={budget} onChange={e=>saveBudget(e.target.value)} placeholder="e.g. 500" />
            <div style={{ fontSize:12, color:C.muted, paddingBottom:10 }}>
              {budgetNum>0 ? `S$${monthSpent.toFixed(2)} of S$${budgetNum.toFixed(2)} used this month` : "Set a budget to track your spending limit"}
            </div>
          </div>
        )}
      </Card>

      {error && <div style={{ color:C.red, marginBottom:12, fontSize:13, padding:"10px 14px", background:C.red+"10", borderRadius:8, borderLeft:`3px solid ${C.red}` }}>{error}</div>}

      {loading ? <EmptyState icon="wallet" message="Loading finances..." /> : (
        <>
          {/* Budget progress bar */}
          {budgetNum>0 && (
            <Card style={{ marginBottom:14, borderColor:budgetColor+"35" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>Monthly budget</div>
                <div style={{ fontSize:13, fontWeight:700, color:budgetColor }}>S${monthSpent.toFixed(2)} / S${budgetNum.toFixed(2)}</div>
              </div>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:999, height:10, overflow:"hidden", marginBottom:6 }}>
                <div style={{ width:`${budgetPct}%`, height:"100%", borderRadius:999, background:budgetColor, transition:"width 0.5s ease" }} />
              </div>
              <div style={{ fontSize:12, color:C.muted }}>
                {budgetPct>=90 ? "⚠️ Almost at your budget limit!" : budgetPct>=70 ? "🟡 You've used over 70% of your budget" : `🟢 S${(budgetNum-monthSpent).toFixed(2)} remaining`}
              </div>
            </Card>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
            <Stat label="Spent this week"  value={`S$${(summary?.total_week||0).toFixed(2)}`}  color={C.amber}  />
            <Stat label="Spent this month" value={`S$${(summary?.total_month||0).toFixed(2)}`} color={C.indigo} />
            <Stat label="Transactions"     value={summary?.expense_count||0}                    color={C.muted}  />
            <Stat label="Top category"     value={`${CAT_EMOJI[summary?.top_category]||""} ${summary?.top_category||"—"}`} color={CAT_COLORS[summary?.top_category]||C.muted} />
          </div>

          {summary?.ai_insight && (
            <Card style={{ marginBottom:14, borderColor:C.amber+"35", padding:"16px 20px" }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.amber, marginBottom:6, letterSpacing:"0.05em" }}>🤖 AI spending insight</div>
              <div style={{ fontSize:14, color:C.text, lineHeight:1.7 }}>{summary.ai_insight}</div>
            </Card>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            {summary&&Object.keys(summary.by_category).length>0 && (
              <Card>
                <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:12, letterSpacing:"0.05em" }}>Spending breakdown — last 30 days</div>
                <div style={{ position:"relative", height:160, marginBottom:16 }}><canvas ref={chartRef} /></div>
                {Object.entries(summary.by_category).map(([cat,amt])=>(
                  <div key={cat} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:CAT_COLORS[cat]||C.muted, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:C.muted, flex:1 }}>{CAT_EMOJI[cat]} {cat}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:CAT_COLORS[cat]||C.muted }}>S${amt.toFixed(2)}</span>
                    <div style={{ width:60, background:"rgba(255,255,255,0.05)", borderRadius:999, height:4, overflow:"hidden" }}>
                      <div style={{ width:`${(amt/Math.max(...Object.values(summary.by_category)))*100}%`, height:"100%", borderRadius:999, background:CAT_COLORS[cat]||C.muted }} />
                    </div>
                  </div>
                ))}
              </Card>
            )}

            <Card>
              <div style={{ fontSize:12, fontWeight:600, color:C.muted, marginBottom:12, letterSpacing:"0.05em" }}>Recent expenses</div>
              {expenses.length===0 ? <EmptyState icon="wallet" message="No expenses yet — log one above!" /> : (
                expenses.slice(0,8).map((e,i)=>(
                  <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<Math.min(expenses.length,8)-1?`1px solid ${C.border}`:"none" }}>
                    <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:(CAT_COLORS[e.category]||C.muted)+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{CAT_EMOJI[e.category]||"📦"}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{e.description||e.category}</div>
                      <div style={{ fontSize:11, color:C.muted }}>
                        <span style={{ background:(CAT_COLORS[e.category]||C.muted)+"20", color:CAT_COLORS[e.category]||C.muted, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600, marginRight:6 }}>{e.category}</span>
                        {e.date}
                      </div>
                    </div>
                    <span style={{ fontSize:14, fontWeight:800, color:CAT_COLORS[e.category]||C.muted, flexShrink:0 }}>S${e.amount.toFixed(2)}</span>
                    <DeleteBtn onClick={()=>deleteExpense(e.id)} />
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}

      {undoItem && <UndoBar message={`S$${undoItem.data.amount.toFixed(2)} expense deleted`} onUndo={undoDelete} onDismiss={()=>setUndoItem(null)} />}
    </div>
  );
}

// ── HACKERNEWS PANEL ──────────────────────────────────────────────────────────
function HackerNewsPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [filter, setFilter]   = useState("all");
  const toast = useToast();

  const load = async () => {
    setLoading(true); setError("");
    try {
      const d = await api("/hackernews/top");
      setData(d);
      toast.show(`Loaded ${d.stories.length} stories`, "info");
    } catch(e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  };

  const FILTERS = [
    { value: "all",      label: "All stories" },
    { value: "relevant", label: "Related to my tasks" },
    { value: "top",      label: "Highest score" },
  ];

  const filtered = data?.stories ? (() => {
    let s = [...data.stories];
    if (filter === "relevant") s = s.filter(x => x.relevant_task);
    if (filter === "top")      s = s.sort((a,b) => b.score - a.score);
    return s;
  })() : [];

  return (
    <div>
      <SectionHeader icon="news" title="HackerNews Agent"
        subtitle="Top tech stories AI-summarised and correlated to your tasks — no API key required" />

      {!data && !loading && (
        <Card style={{ textAlign:"center", padding:"40px 20px", borderColor:C.indigo+"30" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📰</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:6 }}>
            Fetch today's top tech stories
          </div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.7 }}>
            Pulls the top 8 stories from Hacker News, AI-summarises each one,
            and highlights any that relate to your current tasks.
          </div>
          <Btn onClick={load}><Icon d={ICONS.refresh} size={14} /> Load stories</Btn>
        </Card>
      )}

      {loading && <EmptyState icon="news" message="Fetching and summarising top stories..." />}

      {error && <div style={{ color:C.red, marginBottom:12, fontSize:13, padding:"10px 14px",
        background:C.red+"10", borderRadius:8, borderLeft:`3px solid ${C.red}` }}>{error}</div>}

      {data && !loading && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.muted }}>
              {data.stories.length} stories · fetched {new Date(data.fetched_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
            </div>
            <Btn variant="ghost" small onClick={load}><Icon d={ICONS.refresh} size={12} /> Refresh</Btn>
          </div>

          <FilterPills
            options={FILTERS}
            value={filter}
            onChange={setFilter}
          />

          {filtered.length === 0 ? (
            <EmptyState icon="news" message="No stories match this filter" />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.map((s,i) => (
                <Card key={s.id} style={{ borderColor: s.relevant_task ? C.indigo+"40" : C.border }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:6 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:14, fontWeight:700, color:C.indigo, textDecoration:"none", flex:1, lineHeight:1.4 }}
                      onMouseEnter={e=>e.target.style.textDecoration="underline"}
                      onMouseLeave={e=>e.target.style.textDecoration="none"}>
                      {s.title}
                    </a>
                    <div style={{ display:"flex", gap:10, flexShrink:0, fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>
                      <span>⬆️ {s.score}</span>
                      <span>💬 {s.comments}</span>
                      <span>🕐 {s.time_ago}</span>
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:"#c8d0e8", lineHeight:1.6, marginBottom: s.relevant_task ? 8 : 0 }}>
                    {s.summary}
                  </div>
                  {s.relevant_task && (
                    <div style={{ fontSize:11, background:C.indigo+"15", border:`1px solid ${C.indigo}30`,
                      borderRadius:6, padding:"4px 10px", display:"inline-flex", alignItems:"center",
                      gap:6, color:C.indigo }}>
                      🔗 Related to: <strong>{s.relevant_task}</strong>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          <div style={{ fontSize:11, color:C.faint, textAlign:"center", marginTop:14 }}>
            Source: Hacker News Firebase API · news.ycombinator.com · No authentication required
          </div>
        </>
      )}
    </div>
  );
}

// ── SINGAPORE PANEL ───────────────────────────────────────────────────────────
function SingaporePanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [busStop, setBusStop] = useState("83139");
  const [error, setError]     = useState("");
  const toast = useToast();

  const load = async () => {
    setLoading(true); setError("");
    try {
      setData(await api(`/singapore/daily?bus_stop=${busStop}`));
      toast.show("Singapore conditions updated", "info");
    } catch(e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const PSI_COLOR  = s => s==="Good"?C.green:s==="Moderate"?C.amber:s==="Unavailable"?C.muted:C.red;
  const PSI_BG     = s => PSI_COLOR(s) + "15";

  return (
    <div>
      <SectionHeader icon="sgflag" title="Singapore Agent"
        subtitle="Live air quality & bus arrivals from Singapore Government APIs" />

      <div style={{ display:"flex", gap:10, alignItems:"end", marginBottom:16 }}>
        <Input label="Bus stop code" value={busStop}
          onChange={e => setBusStop(e.target.value)}
          placeholder="e.g. 83139"
          tooltip="Find your bus stop code at mytransport.sg or on the bus stop sign" />
        <Btn onClick={load} disabled={loading}>
          <Icon d={ICONS.refresh} size={14} /> {loading ? "Loading..." : "Refresh"}
        </Btn>
      </div>

      {error && <div style={{ color:C.red, marginBottom:12, fontSize:13, padding:"10px 14px",
        background:C.red+"10", borderRadius:8, borderLeft:`3px solid ${C.red}` }}>{error}</div>}

      {loading ? <EmptyState icon="sgflag" message="Fetching live Singapore data..." /> : data && (
        <>
          {/* AI Briefing */}
          <Card style={{ marginBottom:14, borderColor:C.indigo+"40", padding:"18px 22px" }}>
            <div style={{ fontSize:11, fontWeight:600, color:C.indigo, marginBottom:8, letterSpacing:"0.05em" }}>
              🤖 AI DAILY BRIEFING
            </div>
            <div style={{ fontSize:15, color:C.text, lineHeight:1.8 }}>{data.briefing}</div>
          </Card>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>

            {/* Weather */}
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>
                {data.weather?.forecast?.includes("Thunder") ? "⛈️" :
                data.weather?.forecast?.includes("Rain") || data.weather?.forecast?.includes("Shower") ? "🌧️" :
                data.weather?.forecast?.includes("Cloudy") ? "⛅" :
                data.weather?.forecast?.includes("Fair") ? "☀️" : "🌡️"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {data.weather?.forecast || "Unavailable"}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>Near {data.weather?.area || "Singapore"}</div>
              <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>2-hour nowcast</div>
            </Card>

            {/* PSI Card */}
            <Card style={{ borderColor: PSI_COLOR(data.psi.status) + "40", textAlign:"center", padding:"24px 20px" }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:12, letterSpacing:"0.05em" }}>
                AIR QUALITY INDEX (PSI)
              </div>
              <div style={{ fontSize:48, fontWeight:900, color:PSI_COLOR(data.psi.status), marginBottom:6, lineHeight:1 }}>
                {data.psi.psi ?? "—"}
              </div>
              <div style={{ display:"inline-block", background:PSI_BG(data.psi.status),
                borderRadius:20, padding:"4px 16px", fontSize:13, fontWeight:700,
                color:PSI_COLOR(data.psi.status), marginBottom:10 }}>
                {data.psi.status}
              </div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
                {data.psi.status==="Good" && "Safe for all outdoor activities"}
                {data.psi.status==="Moderate" && "Sensitive groups: limit prolonged outdoor exertion"}
                {data.psi.status==="Unhealthy" && "Reduce outdoor activities"}
                {data.psi.status==="Unavailable" && "PSI data temporarily unavailable"}
              </div>
              {data.psi.updated && (
                <div style={{ fontSize:10, color:C.faint, marginTop:8 }}>
                  Updated: {new Date(data.psi.updated).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                </div>
              )}
            </Card>

            {/* Bus Card */}
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.indigo, marginBottom: 10, letterSpacing: "0.05em" }}>
                🚌 BUS ARRIVALS — STOP {data.bus_stop || "83139"}
              </div>
              {data.bus_arrivals && data.bus_arrivals.length > 0 ? (
                data.bus_arrivals.map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < data.bus_arrivals.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ background: C.indigo, color: "#fff", borderRadius: 6, padding: "2px 10px", fontWeight: 700, fontSize: 13 }}>
                        {b.service}
                      </span>
                      <span style={{ fontSize: 12, color: C.muted }}>{b.load || "Seats available"}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: b.eta_min === 0 ? C.green : C.text }}>
                      {b.eta_min === 0 ? "Arriving" : `${b.eta_min} min`}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: C.muted }}>
                  {data.bus_arrivals ? "No buses found for this stop." : "Set LTA_API_KEY in .env to enable bus arrivals."}
                </div>
              )}
            </Card>
        </div>
          <div style={{ fontSize:11, color:C.faint, textAlign:"center" }}>
            Sources: data.gov.sg (PSI — National Environment Agency) ·
            datamall.lta.gov.sg (Bus — Land Transport Authority)
          </div>
        </>
      )}
    </div>
  );
}

// ── RESEARCH PANEL ────────────────────────────────────────────────────────────
function ResearchPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery]     = useState("");
  const [error, setError]     = useState("");
  const toast = useToast();

  const search = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setLoading(true); setError("");
    try {
      const endpoint = q
        ? `/research/search?query=${encodeURIComponent(q)}`
        : `/research/search?query=${encodeURIComponent(query)}`;
      setData(await api(endpoint));
      toast.show(`Found papers for "${searchQuery}"`, "info");
    } catch(e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  };

  const suggest = async () => {
    setLoading(true); setError("");
    try {
      const d = await api("/research/suggest");
      setData(d);
      setQuery(d.query);
      toast.show(`Showing papers for "${d.query}"`, "info");
    } catch(e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  };

  const QUICK_SEARCHES = [
    "cloud computing microservices",
    "procrastination academic performance",
    "REST API design patterns",
    "personal assistant AI agent",
  ];

  return (
    <div>
      <SectionHeader icon="academic" title="Research Assistant"
        subtitle="Find academic papers from arXiv.org (Cornell University) — no API key required" />

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:10, alignItems:"end", marginBottom:10 }}>
          <Input label="Search topic" value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. microservices architecture, procrastination AI..."
            onKeyDown={e => e.key==="Enter" && search()} />
          <Btn onClick={() => search()} disabled={loading || !query.trim()}>
            <Icon d={ICONS.refresh} size={14} /> Search
          </Btn>
          <Btn variant="ghost" onClick={suggest} disabled={loading}>
            ✨ Auto from tasks
          </Btn>
        </div>

        {/* Quick search pills */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {QUICK_SEARCHES.map(q => (
            <button key={q} onClick={() => { setQuery(q); search(q); }} style={{
              background:"rgba(124,140,248,0.08)", border:`1px solid rgba(124,140,248,0.2)`,
              borderRadius:20, padding:"3px 12px", fontSize:11, color:"#a0aaff",
              cursor:"pointer", fontFamily:"inherit",
            }}>{q}</button>
          ))}
        </div>
      </Card>

      {!data && !loading && (
        <Card style={{ textAlign:"center", padding:"40px 20px", borderColor:C.indigo+"30" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📚</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:6 }}>
            Search 2 million+ academic papers
          </div>
          <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>
            Type a topic above or click "Auto from tasks" to find papers
            relevant to what you're currently working on.
          </div>
        </Card>
      )}

      {error && <div style={{ color:C.red, marginBottom:12, fontSize:13, padding:"10px 14px",
        background:C.red+"10", borderRadius:8, borderLeft:`3px solid ${C.red}` }}>{error}</div>}

      {loading && <EmptyState icon="academic" message="Searching arXiv.org..." />}

      {data && !loading && (
        <>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            {data.papers.length} papers for "{data.query}" · {data.source}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {data.papers.map((p,i) => (
              <Card key={i}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:5 }}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:14, fontWeight:700, color:C.indigo, textDecoration:"none", flex:1, lineHeight:1.4 }}
                    onMouseEnter={e=>e.target.style.textDecoration="underline"}
                    onMouseLeave={e=>e.target.style.textDecoration="none"}>
                    {p.title}
                  </a>
                  <span style={{ fontSize:11, color:C.faint, flexShrink:0 }}>{p.published}</span>
                </div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{p.authors.join(", ")}</div>
                {p.relevance && (
                  <div style={{ fontSize:13, color:C.green, marginBottom:6, display:"flex", gap:6 }}>
                    <span style={{ flexShrink:0 }}>💡</span> {p.relevance}
                  </div>
                )}
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{p.summary}</div>
              </Card>
            ))}
          </div>
          <div style={{ fontSize:11, color:C.faint, textAlign:"center", marginTop:14 }}>
            Source: arXiv.org open access preprint server · Cornell University · HTTPS · No authentication
          </div>
        </>
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ onNav }) {
  const [status, setStatus] = useState(null);
  const [risk, setRisk]     = useState(null);

  useEffect(() => {
    api("/status").then(setStatus).catch(()=>{});
    api("/procrastination/analyse").then(setRisk).catch(()=>{});
  }, []);

  const services = [
    { name:"Task Manager",       desc:"Create, track & complete tasks",           icon:"tasks",    tab:"tasks",           color:C.indigo },
    { name:"Scheduler",          desc:"Events & calendar reminders",               icon:"calendar", tab:"scheduler",       color:C.amber  },
    { name:"GitHub Agent",       desc:"AI repo analysis & trending repos",         icon:"github",   tab:"github",          color:C.green  },
    { name:"Mastodon Agent",     desc:"AI social feed analysis & trend mining",    icon:"mastodon", tab:"mastodon",        color:C.red    },
    { name:"HackerNews Agent",   desc:"Top tech stories AI-summarised",            icon:"news",     tab:"hackernews",      color:C.amber  },
    { name:"Singapore Agent",    desc:"Live PSI, weather & bus arrivals",          icon:"sgflag",   tab:"singapore",       color:C.green  },
    { name:"Research Assistant", desc:"arXiv academic papers linked to tasks",     icon:"academic", tab:"research",        color:C.indigo },
    { name:"PA Chat",            desc:"Ask or command your AI assistant",          icon:"chat",     tab:"chat",            color:C.purple },
    { name:"Focus Mode",         desc:"Pomodoro timer & procrastination AI",       icon:"focus",    tab:"procrastination", color:C.cyan   },
    { name:"Finance",            desc:"Expense tracking & AI insights",            icon:"wallet",   tab:"finance",         color:C.amber  },
    { name:"Reports",            desc:"Charts, weather & AI daily briefing",       icon:"reports",  tab:"reports",         color:C.indigo },
  ];
  const riskColor = risk ? RISK_COLOR[risk.risk_level] : C.muted;

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:"0 0 5px", fontSize:24, fontWeight:800, color:C.text }}>Good day! 👋</h1>
        <p style={{ margin:0, color:C.muted, fontSize:13 }}>Your Personal Assistant is ready.</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:12 }}>
        <Stat label="Total tasks"  value={status?.total_tasks     ?? "—"} color={C.indigo} onClick={()=>onNav("tasks")}     />
        <Stat label="Pending"      value={status?.pending_tasks   ?? "—"} color={C.amber}  onClick={()=>onNav("tasks")}     />
        <Stat label="Completed"    value={status?.completed_tasks ?? "—"} color={C.green}  onClick={()=>onNav("tasks")}     />
        <Stat label="Events"       value={status?.upcoming_events ?? "—"} color={C.red}    onClick={()=>onNav("scheduler")} />
        <Stat label="Expenses"     value={status?.total_expenses  ?? "—"} color={C.amber}  onClick={()=>onNav("finance")}  />
      </div>

      {risk && (
        <Card style={{ marginBottom:12, borderColor:riskColor+"35", cursor:"pointer" }} onClick={()=>onNav("procrastination")}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:22 }}>{RISK_EMOJI[risk.risk_level]}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:riskColor }}>
                {risk.risk_level.charAt(0).toUpperCase()+risk.risk_level.slice(1)} procrastination risk
              </div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                {risk.completion_rate}% complete · {risk.overdue.length} overdue
                {risk.patterns[0]?` · ${risk.patterns[0].split("—")[0].trim()}`:" · Looking good!"}
              </div>
            </div>
            {risk.nudge?.one_task && (
              <div style={{ textAlign:"right", maxWidth:180 }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Start with</div>
                <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{risk.nudge.one_task}</div>
              </div>
            )}
            <span style={{ color:C.muted }}>›</span>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:C.muted, marginBottom:14, letterSpacing:"0.06em", textTransform:"uppercase" }}>All services</div>
        {[
          { label: "Core",      items: services.filter(s => ["tasks","scheduler"].includes(s.tab)) },
          { label: "AI Agents", items: services.filter(s => ["github","mastodon","hackernews","singapore","research"].includes(s.tab)) },
          { label: "Personal",  items: services.filter(s => ["chat","procrastination","finance","reports"].includes(s.tab)) },
        ].map(group => (
          <div key={group.label} style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.faint, letterSpacing:"0.12em",
              textTransform:"uppercase", marginBottom:6, paddingBottom:6,
              borderBottom:`1px solid ${C.border}` }}>
              {group.label}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2 }}>
              {group.items.map(s=>(
                <div key={s.name} onClick={()=>onNav(s.tab)} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"10px 12px", cursor:"pointer", borderRadius:8, transition:"background 0.15s",
                }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.hover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{ background:s.color+"18", borderRadius:8, padding:8, color:s.color, display:"flex", flexShrink:0 }}>
                    <Icon d={ICONS[s.icon]} size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.name}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>    
    </div>
  );
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
const TABS = [
  { id:"dashboard",       label:"Dashboard",  icon:"dashboard" },
  { id:"tasks",           label:"Tasks",      icon:"tasks"     },
  { id:"scheduler",       label:"Scheduler",  icon:"calendar"  },
  { id:"github",          label:"GitHub",     icon:"github"    },
  { id:"mastodon",        label:"Mastodon",   icon:"mastodon"  },
  { id:"chat",            label:"PA Chat",    icon:"chat"      },
  { id:"procrastination", label:"Focus Mode", icon:"focus"     },
  { id:"reports",         label:"Reports",    icon:"reports"   },
  { id:"finance",         label:"Finance",    icon:"wallet"    },
  { id: "hackernews", label: "Tech News",  icon: "news"     },
  { id: "singapore",  label: "SG Context", icon: "sgflag"   },
  { id: "research",   label: "Research",   icon: "academic"  },
];

export default function App() {
  const [tab, setTab]                   = useState("dashboard");
  const [riskLevel, setRiskLevel]       = useState("low");
  const [focusLockDismissed, setFocusLockDismissed] = useState(false);

  useEffect(() => {
    const checkRisk = () => {
      if (document.visibilityState === "visible") {
        api("/procrastination/analyse").then(d => setRiskLevel(d.risk_level)).catch(() => {});
      }
    };
    checkRisk();
    const interval = setInterval(checkRisk, 60000);
    document.addEventListener("visibilitychange", checkRisk);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", checkRisk);
    };
  }, []);

  // Reset focus lock when risk drops
  useEffect(() => {
    if (riskLevel !== "high") setFocusLockDismissed(false);
  }, [riskLevel]);

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", color:C.text, fontFamily:"'Inter',system-ui,sans-serif", display:"flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Toast container — top right */}
      <ToastContainer />

      {/* Focus Lock — only HIGH risk */}
      {riskLevel==="high" && !focusLockDismissed && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.96)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔴</div>
          <h1 style={{ fontSize:24, fontWeight:800, color:C.red, marginBottom:8 }}>High procrastination risk</h1>
          <p style={{ fontSize:14, color:C.muted, maxWidth:420, lineHeight:1.8, marginBottom:10 }}>
            Your task analysis shows overdue or neglected high-priority work. Research shows acknowledging this before opening other apps significantly improves follow-through.
          </p>
          <div style={{ background:C.red+"10", border:`1px solid ${C.red}25`, borderRadius:10, padding:"14px 20px", marginBottom:24, maxWidth:400 }}>
            <div style={{ fontSize:13, color:C.amber, fontStyle:"italic", lineHeight:1.7 }}>
              "Implementation intentions increase follow-through by up to 300%. Commit to ONE task before you continue."
              <br /><span style={{ fontSize:11, color:C.muted }}>— Gollwitzer, 1999</span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:320 }}>
            <Btn onClick={()=>{setFocusLockDismissed(true);setTab("procrastination");}}>📋 Show me my focus plan</Btn>
            <Btn variant="ghost" onClick={()=>setFocusLockDismissed(true)}>I acknowledge my backlog — let me in</Btn>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <nav style={{ width:210, minHeight:"100vh", background:"rgba(255,255,255,0.015)", borderRight:`1px solid ${C.border}`, padding:"20px 0", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"0 18px 20px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:800, letterSpacing:"0.1em", color:C.indigo, textTransform:"uppercase" }}>PA-as-a-Service</div>
          <div style={{ fontSize:11, color:C.faint, marginTop:2 }}>Personal Assistant v2.0</div>
        </div>
        <div style={{ padding:"14px 10px", flex:1, overflowY:"auto" }}>
          {[
            { label: "Core",      tabs: ["dashboard","tasks","scheduler"] },
            { label: "AI Agents", tabs: ["github","mastodon","hackernews","singapore","research"] },
            { label: "Personal",  tabs: ["chat","procrastination","finance","reports"] },
          ].map(group => (
            <div key={group.label} style={{ marginBottom:6 }}>
              <div style={{ fontSize:9, fontWeight:700, color:C.faint, letterSpacing:"0.12em",
                textTransform:"uppercase", padding:"8px 12px 4px" }}>
                {group.label}
              </div>
              {TABS.filter(t => group.tabs.includes(t.id)).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  width:"100%", display:"flex", alignItems:"center", gap:10,
                  padding:"8px 12px", borderRadius:8, border:"none",
                  background: tab===t.id ? "rgba(124,140,248,0.12)" : "transparent",
                  color: tab===t.id ? C.indigo : C.muted,
                  fontWeight: tab===t.id ? 700 : 400,
                  fontSize:13, cursor:"pointer", fontFamily:"inherit",
                  marginBottom:1, textAlign:"left", transition:"all 0.15s",
                }}>
                  <Icon d={ICONS[t.icon]} size={15} />
                  {t.label}
                  {t.id==="chat" && (
                    <span style={{ marginLeft:"auto", background:"rgba(167,139,250,0.15)",
                      color:C.purple, fontSize:9, fontWeight:700,
                      padding:"2px 6px", borderRadius:4 }}>AI</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex:1, padding:"30px 34px", maxWidth:1100, overflowY:"auto" }}>
        {tab==="dashboard"       && <Dashboard onNav={setTab} />}
        {tab==="tasks"           && <TasksPanel />}
        {tab==="scheduler"       && <SchedulerPanel />}
        {tab==="github"          && <GitHubPanel />}
        {tab==="mastodon"        && <MastodonPanel riskLevel={riskLevel} />}
        {tab==="chat"            && <ChatPanel />}
        {tab==="procrastination" && <ProcrastinationPanel />}
        {tab==="reports"         && <ReportsPanel />}
        {tab==="finance"         && <FinancePanel />}
        {tab === "hackernews"  && <HackerNewsPanel />}
        {tab === "singapore"   && <SingaporePanel />}
        {tab === "research"    && <ResearchPanel />}
      </main>
    </div>
  );
}

