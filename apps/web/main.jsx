import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { analyze, validateFile } from "../../packages/shared/index.js";
import {
  client,
  history,
  loadSequence,
  save,
} from "../../packages/supabase/index.js";
import "./styles.css";

const db = client(import.meta.env.EXPO_PUBLIC_GATEWAY_URL);
const example = "ACGTTGCAAGTCCGATGGCATTCG";
const baseColors = {
  A: "#a8dc79",
  C: "#68cabc",
  G: "#edb56b",
  T: "#b59cdd",
};
const fmt = (value) =>
  value == null ? "Undefined" : Number(value.toFixed(2)).toString();

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>GeneScan</span>
    </span>
  );
}

function PageHeader({ page, result, wide }) {
  const sequence = (result?.sequence || example).slice(0, 24);
  return (
    <header className="page-header">
      <div>
        <h1>
          {page === "Analyzer"
            ? "Sequence analyzer"
            : page === "Dashboard"
              ? "Analysis dashboard"
              : "Your account"}
        </h1>
        <p>
          {page === "Analyzer"
            ? "Explore base composition, GC content and reverse complements."
            : page === "Dashboard"
              ? "Review your saved sequences and recent activity."
              : "Access your private sequence library."}
        </p>
      </div>
      {wide && (
        <div className="dna-art" aria-label="Illustration of paired DNA bases">
          {[...sequence].map((base, index) => {
            const phase = Math.sin(index * 0.31);
            const partner = { A: "T", T: "A", C: "G", G: "C" };
            const pair =
              phase >= 0 ? [base, partner[base]] : [partner[base], base];
            return (
              <span
                className="dna-rung"
                key={`${base}-${index}`}
                style={{ height: `${7 + 78 * Math.abs(phase)}px` }}
              >
                {pair.map((letter, pairIndex) => (
                  <i
                    key={pairIndex}
                    style={{ backgroundColor: baseColors[letter] || "#dae5d3" }}
                  />
                ))}
              </span>
            );
          })}
        </div>
      )}
    </header>
  );
}

function Button({ children, primary = false, disabled = false, ...props }) {
  return (
    <button
      aria-label={typeof children === "string" ? children : undefined}
      className={`button${primary ? " primary" : ""}`}
      type="button"
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Field({ label, className = "", multiline = false, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea className={className} aria-label={label} {...props} />
      ) : (
        <input className={className} aria-label={label} {...props} />
      )}
    </label>
  );
}

function Workspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInput = useRef(null);
  const page =
    location.pathname === "/dashboard"
      ? "Dashboard"
      : location.pathname === "/account"
        ? "Account"
        : "Analyzer";
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!db);
  const [mode, setMode] = useState("Sign in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const wide = window.matchMedia("(min-width: 800px)").matches;

  useEffect(() => {
    if (!db) return undefined;
    const { data } = db.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (event === "SIGNED_OUT") {
        setRecords([]);
        setStats(null);
        setSaved(false);
        setPassword("");
        setConfirm("");
        setEmail("");
        setShowPassword(false);
        setMode("Sign in");
        setResult(null);
        setRaw("");
        setFile(null);
        setName("");
        navigate("/");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (authReady && page === "Dashboard" && !session) {
      setMode("Sign in");
      navigate("/account", { replace: true });
    }
  }, [authReady, page, session, navigate]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!db || !userId || page !== "Dashboard") return undefined;

    let channel = db.channel(`genescan-web-user-${userId}`);
    for (const table of [
      "profiles",
      "dna_sequences",
      "sequence_analyses",
      "analysis_history",
      "uploaded_files",
    ]) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter:
            table === "profiles" ? `id=eq.${userId}` : `user_id=eq.${userId}`,
        },
        () => setReload((value) => value + 1),
      );
    }

    channel.subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setMessage(
          `Live updates unavailable: ${
            error?.message || "Realtime connection failed."
          }`,
        );
      }
    });
    return () => {
      db.removeChannel(channel);
    };
  }, [session?.user.id, page]);

  useEffect(() => {
    let active = true;
    if (session && page === "Dashboard") {
      setStats(null);
      setRecords([]);
      Promise.all([
        history(db),
        db
          .from("sequence_analyses")
          .select("id", { count: "exact", head: true }),
        db.from("uploaded_files").select("id", { count: "exact", head: true }),
      ])
        .then(([rows, analyses, uploads]) => {
          if (analyses.error || uploads.error) {
            throw analyses.error || uploads.error;
          }
          if (active) {
            setRecords(rows);
            setStats({ total: analyses.count, uploaded: uploads.count });
          }
        })
        .catch((error) => {
          if (active) setMessage(error.message);
        });
    }
    return () => {
      active = false;
    };
  }, [session?.user.id, page, reload]);

  function go(target) {
    setMessage("");
    if (target === "Account") {
      setMode("Sign in");
    }
    navigate(
      target === "Dashboard" && !session
        ? "/account"
        : {
            Analyzer: "/",
            Dashboard: "/dashboard",
            Account: "/account",
          }[target],
    );
  }

  function edit(value) {
    setRaw(value);
    setResult(null);
    setFile(null);
    setSaved(false);
    setMessage("");
  }

  async function run(operation) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setMessage(
        error.message === "Failed to fetch"
          ? "Cannot reach the GeneScan gateway. Start it with npm run gateway and set EXPO_PUBLIC_GATEWAY_URL to a reachable gateway address."
          : error.message || "Operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function authenticate() {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw Error("Enter a valid email address.");
    }
    if (!password) {
      throw Error("Enter your password.");
    }
    if (
      mode === "Register" &&
      (password.length < 8 || password !== confirm)
    ) {
      throw Error("Use at least eight characters and match both passwords.");
    }
    if (!db)
      throw Error("Configure the shared Supabase project to use accounts.");

    let response;
    if (mode === "Register") {
      response = await db.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() } },
      });
    } else {
      response = await db.auth.signInWithPassword({ email, password });
    }
    if (response.error) throw response.error;
    setPassword("");
    setConfirm("");
    setMessage(
      mode === "Register" ? "Account created. You are signed in." : "Account updated.",
    );
    setMode("Sign in");
  }

  function action(label, operation, primary = false) {
    return (
      <Button
        key={label}
        primary={primary}
        disabled={busy}
        onClick={() => run(operation)}
      >
        {label}
      </Button>
    );
  }

  const totals = useMemo(
    () =>
      records.reduce(
        (sum, record) => {
          for (const base of "ACGT") {
            sum[base] += record.composition?.[base] || 0;
          }
          return sum;
        },
        { A: 0, C: 0, G: 0, T: 0 },
      ),
    [records],
  );
  const canonicalTotal = Object.values(totals).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <Brand />
        <div className="nav-tabs">
          {["Analyzer", "Dashboard", "Account"].map((item) => (
            <button
              type="button"
              key={item}
              aria-label={item}
              className={`nav-tab${page === item ? " active" : ""}`}
              aria-current={page === item ? "page" : undefined}
              onClick={() => go(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>
      <main className="workspace">
        <PageHeader page={page} wide={wide} result={result} />
        {message && (
          <div data-testid="message" className="notice" role="status" aria-live="polite">
            {message}
          </div>
        )}
        {busy && (
          <p className="working" role="status">
            Working…
          </p>
        )}

        {page === "Analyzer" && (
          <div className="analyzer-layout">
            <section className="panel input-panel">
              <div className="panel-heading">
                <h2>Sequence input</h2>
                {!raw.trim() && (
                  <Button
                    onClick={() => {
                      edit(example);
                      setName("Example sequence");
                    }}
                  >
                    Use example
                  </Button>
                )}
              </div>
              <Field
                label="Sequence name"
                placeholder="Untitled sequence"
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Field
                label="DNA sequence"
                placeholder={">sample_01\nACGT…"}
                value={raw}
                multiline
                onChange={(event) => edit(event.target.value)}
                className="sequence-input"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
              />
              <p className="hint">
                FASTA or TXT · One record · Up to 100,000 bases
              </p>
              <div className="button-row">
                {action(
                  "Analyze",
                  () => {
                    setResult(analyze(raw));
                    setSaved(false);
                  },
                  true,
                )}
                {action("Import file", () => fileInput.current?.click())}
                {action("Clear", () => {
                  edit("");
                  setName("");
                })}
                <input
                  id="sequence-file" ref={fileInput}
                  className="visually-hidden"
                  type="file"
                  accept=".fa,.fna,.fasta,.txt"
                  aria-label="Choose FASTA or TXT file"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    event.target.value = "";
                    if (!selected) return;
                    run(async () => {
                      validateFile(selected.name, selected.size);
                      const text = await selected.text();
                      edit(text);
                      setFile(
                        new File([text], selected.name, {
                          type: selected.type || "text/plain",
                        }),
                      );
                      setName(selected.name);
                    });
                  }}
                />
              </div>
              {file && <p className="hint selected-file">{file.name}</p>}
            </section>

            <section className="panel results-panel">
              <h2>Analysis results</h2>
              {!result ? (
                <div className="empty-results">
                  <div className="base-legend">
                    {Object.entries(baseColors).map(([base, color]) => (
                      <span key={base} style={{ backgroundColor: color }}>
                        {base}
                      </span>
                    ))}
                  </div>
                  <strong>Awaiting sequence</strong>
                  <p>
                    Select Analyze to see composition, ratios and the reverse
                    complement.
                  </p>
                </div>
              ) : (
                <>
                  <div className="metrics">
                    {Object.entries({
                      "Sequence length": result.length,
                      "GC content":
                        fmt(result.gc) + (result.gc === null ? "" : "%"),
                      "AT content":
                        fmt(result.at) + (result.at === null ? "" : "%"),
                      "Ambiguous bases": result.ambiguous,
                      "AT/GC ratio": fmt(result.ratio),
                    }).map(([label, value]) => (
                      <div data-testid={label} className="metric" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <h3>Nucleotide distribution</h3>
                  <div className="distribution">
                    {Object.entries(result.counts)
                      .filter(([base, count]) => "ACGT".includes(base) || count)
                      .map(([base, count]) => (
                        <div className="base-count" key={base}>
                          <span data-testid={"count-" + base}>
                            {base} {count} ·{" "}
                            {fmt(result.frequencies[base] * 100)}%
                          </span>
                          <div className="bar">
                            <span
                              style={{
                                width: `${result.frequencies[base] * 100}%`,
                                backgroundColor: baseColors[base] || "#285e42",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                  <h3>Reverse complement</h3>
                  <p data-testid="reverse" className="reverse-sequence">{result.reverse}</p>
                  <p className="hint">{result.timestamp}</p>
                  <p className="hint">
                    GC and AT percentages use canonical bases. Frequencies use
                    all positions. A zero denominator is undefined.
                  </p>
                  <div className="button-row">
                    {action(
                      saved ? "Saved" : "Save analysis",
                      async () => {
                        if (saved) return;
                        if (!session) {
                          go("Account");
                          return;
                        }
                        await save(db, name, result, file, raw);
                        setSaved(true);
                      },
                      true,
                    )}
                    {action("Export JSON", () => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(result, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = "genescan-analysis.json";
                      anchor.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    })}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {page === "Account" && (
          <section className="panel account-panel">
            {session ? (
              <>
                <p>{session.user.email}</p>
                {action(
                  "Sign out",
                  async () => {
                    const { error } = await db.auth.signOut();
                    if (error) throw error;
                  },
                  true,
                )}
              </>
            ) : (
              <form noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  run(authenticate);
                }}
              >
                <h2>{mode}</h2>
                {mode === "Register" && <Field label="Display name" maxLength={120} value={displayName} onChange={e => setDisplayName(e.target.value)} />}
<Field
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoCapitalize="none"
                  />
                <>
                    <Field
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "Register"
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? "Hide password" : "Show password"}
                    </Button>
                  </>
                {mode === "Register" && (
                  <Field
                    label="Confirm password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                )}
                <button
                  className="button primary"
                  aria-label={mode} type="submit"
                  disabled={busy}
                >
                  {mode}
                </button>
                <div className="button-row">
                  {["Sign in", "Register"]
                    .filter((item) => item !== mode)
                    .map((item) => (
                      <Button
                        key={item}
                        onClick={() => {
                          setMode(item);
                          setShowPassword(false);
                          setPassword("");
                          setConfirm("");
                          setMessage("");
                        }}
                      >
                        {item}
                      </Button>
                    ))}
                </div>
              </form>
            )}
          </section>
        )}

        {page === "Dashboard" && session && !stats && (
          <section className="panel dashboard-panel">
            {message ? (
              <Button
                onClick={() => {
                  setMessage("");
                  setReload((value) => value + 1);
                }}
              >
                Retry dashboard
              </Button>
            ) : (
              <p role="status" aria-live="polite">
                Loading analysis history...
              </p>
            )}
          </section>
        )}
        {page === "Dashboard" && session && stats && (
          <section className="panel dashboard-panel">
            <h2>Analysis overview</h2>
            <p>Total saved analyses · {stats.total}</p>
            <p>Total uploaded sequences · {stats.uploaded}</p>
            <h2>Recent activity</h2>
            <p>
              Latest {records.length} saved analyses ·{" "}
              {records.filter((record) => record.uploaded_files?.length).length}{" "}
              imported
            </p>
            <p>
              Canonical counts ·{" "}
              {Object.entries(totals)
                .map(([base, count]) => `${base} ${count}`)
                .join("   ")}
            </p>
            {canonicalTotal > 0 && (
              <p>
                GC across recent canonical bases{" "}
                {fmt((100 * (totals.G + totals.C)) / canonicalTotal)}%
              </p>
            )}
            {records.length === 0 ? (
              <p>Your saved analyses will appear here.</p>
            ) : (
              <div className="history-list">
                {records.map((record) => (
                  <article className="history-item" key={record.id}>
                    <p>
                      {record.dna_sequences?.name || "Untitled sequence"} ·{" "}
                      {fmt(record.gc)} GC% · {record.created_at}
                    </p>
                    <p>{record.owner?.display_name} · {record.owner?.email} · {Object.values(record.composition).reduce((sum, n) => sum + n, 0)} bases · {record.uploaded_files?.[0]?.filename || "Pasted sequence"}</p>
<Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const bases = await loadSequence(
                            db,
                            record.sequence_id,
                          );
                          edit(bases);
                          setName(record.dna_sequences?.name || "");
                          setResult({
                            ...analyze(bases),
                            timestamp: record.created_at,
                          });
                          setSaved(true);
                          navigate("/");
                        })
                      }
                    >
                      Open analysis
                    </Button>
                  </article>
                ))}
              </div>
            )}
            <Button
              onClick={() => {
                edit("");
                setName("");
                navigate("/");
              }}
            >
              New analysis
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Workspace />
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(<App />);
