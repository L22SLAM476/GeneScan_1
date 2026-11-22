import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
  BackHandler,
} from "react-native";
import { analyze, validateFile } from "../shared/index.js";
import {
  Brand,
  WorkspaceHeader,
  baseColors,
  example,
} from "./WorkspaceHeader.jsx";
import { history, loadSequence, save } from "../supabase/index.js";
const ink = "#203a30",
  green = "#285e42",
  muted = "#56695e",
  line = "#dce2d7",
  paper = "#fff";
const card = {
  backgroundColor: paper,
  borderWidth: 1,
  borderColor: line,
  borderRadius: 18,
  padding: 22,
  gap: 14,
};
const field = {
  backgroundColor: "#f7f8f3",
  color: ink,
  borderWidth: 1,
  borderColor: "#cbd4c6",
  borderRadius: 7,
  padding: 12,
  fontSize: 16,
};
function T({ children, style, ...props }) {
  return (
    <Text {...props} style={[{ color: ink, fontSize: 15 }, style]}>
      {children}
    </Text>
  );
}
function B({ title, onPress, primary, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: primary ? green : "#f0f3eb",
        minHeight: 42,
        justifyContent: "center",
        opacity: disabled || pressed ? 0.55 : 1,
        borderRadius: 7,
      })}
    >
      <T style={{ color: primary ? "white" : ink, fontWeight: "600" }}>
        {title}
      </T>
    </Pressable>
  );
}
function Input({ label, ...props }) {
  return (
    <View style={{ gap: 5 }}>
      <T style={{ fontWeight: "600" }}>{label}</T>
      <TextInput
        {...props}
        accessibilityLabel={label}
        style={[field, props.style]}
      />
    </View>
  );
}
const row = {
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
};
const fmt = (v) => (v == null ? "Undefined" : Number(v.toFixed(2)).toString());
export default function Workspace({
  db,
  pick,
  download,
  redirect,
}) {
  const wide = useWindowDimensions().width >= 800;
  const [page, nav] = useState("Analyzer"),
    [session, setSession] = useState(null),
    [mode, setMode] = useState("Sign in"),
    [email, E] = useState(""),
    [pass, P] = useState(""),
    [confirm, C] = useState(""),
    [show, S] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [raw, R] = useState(""),
    [name, N] = useState(""),
    [file, F] = useState(null),
    [result, Q] = useState(null),
    [records, H] = useState([]),
    [stats, G] = useState(null),
    [reload, setReload] = useState(0),
    [message, M] = useState(""),
    [busy, L] = useState(false),
    [saved, V] = useState(false);
  useEffect(() => {
    if (!db) return;
    const sub = db.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") {
        H([]);
        G(null);
        V(false);
        P("");
        C("");
        E("");
        S(false);
        setMode("Sign in");
        Q(null);
        R("");
        F(null);
        N("");
        nav("Analyzer");
      }
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, [db]);
  useEffect(() => {
    if (!db || !session?.user.id) return;
    const userId = session.user.id;
    let channel = db.channel("genescan-user-" + userId);
    for (const table of [
      "profiles",
      "dna_sequences",
      "sequence_analyses",
      "analysis_history",
      "uploaded_files",
    ])
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter:
            table === "profiles"
              ? "id=eq." + userId
              : "user_id=eq." + userId,
        },
        () => setReload((value) => value + 1),
      );
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") M(previous => previous.startsWith("Live updates unavailable:") ? "" : previous);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        M(
          "Live updates unavailable: " +
            (error?.message || "Realtime connection failed."),
        );
    });
    return () => {
      db.removeChannel(channel);
    };
  }, [db, session?.user.id]);
  useEffect(() => {
    let alive = true;
    if (session && page === "Dashboard") {
      G(null);
      H([]);
      Promise.all([
        history(db),
        db
          .from("sequence_analyses")
          .select("id", { count: "exact", head: true }),
        db.from("uploaded_files").select("id", { count: "exact", head: true }),
      ])
        .then(([rows, a, b]) => {
          if (a.error || b.error) throw a.error || b.error;
          if (alive) {
            H(rows);
            G({ total: a.count, uploaded: b.count });
          }
        })
        .catch((e) => {
          if (alive) M(e.message);
        });
    }
    return () => {
      alive = false;
    };
  }, [session?.user.id, page, reload, db]);
  useEffect(() => {
    if (Platform.OS !== "android" || page === "Analyzer") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      go("Analyzer");
      return true;
    });
    return () => sub.remove();
  }, [page]);
  async function run(fn) {
    if (busy) return;
    L(true);
    M("");
    try {
      await fn();
    } catch (e) {
      M(
        e.message === "Failed to fetch"
          ? "Cannot reach the GeneScan gateway. Start it with npm run gateway and set EXPO_PUBLIC_GATEWAY_URL to a reachable gateway address."
          : e.message || "Operation failed.",
      );
    } finally {
      L(false);
    }
  }
  function edit(value) {
    R(value);
    Q(null);
    F(null);
    V(false);
    M("");
  }
  function go(target) {
    M("");
    if (target === "Account") setMode("Sign in");
    nav(target === "Dashboard" && !session ? "Account" : target);
  }
  async function auth() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error("Enter a valid email address.");
    if (!pass)
      throw Error("Enter your password.");
    if (
      mode === "Register" &&
      (pass.length < 8 || pass !== confirm)
    )
      throw Error("Use at least eight characters and match both passwords.");
    if (!db)
      throw Error("Configure the shared Supabase project to use accounts.");
    let response;
    if (mode === "Register")
      response = await db.auth.signUp({
        email,
        password: pass,
        options: { data: { display_name: displayName.trim() } },
      });
    else response = await db.auth.signInWithPassword({ email, password: pass });
    if (response.error) throw response.error;
    P("");
    C("");
    M(
      mode === "Register" ? "Account created. You are signed in." : "Account updated.",
    );
    setMode("Sign in");
  }
  const title = (s) => <T style={{ fontSize: 22, fontWeight: "700" }}>{s}</T>;
  const action = (title, fn, primary = false) => (
    <B
      key={title}
      {...{ title, primary }}
      disabled={busy}
      onPress={() => run(fn)}
    />
  );
  const totals = records.reduce(
    (sum, r) => {
      for (const b of "ACGT") sum[b] += r.composition[b];
      return sum;
    },
    { A: 0, C: 0, G: 0, T: 0 },
  );
  const canonicalTotal = Object.values(totals).reduce(
    (sum, count) => sum + count,
    0,
  );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: "#f5f5ee" }}
      contentContainerStyle={{ minHeight: "100%" }}
    >
      <View
        style={{
          backgroundColor: "#fbfcf8",
          borderBottomWidth: 1,
          borderColor: line,
          paddingHorizontal: wide ? 48 : 14,
          paddingVertical: wide ? 14 : 10,
          ...row,
          justifyContent: "space-between",
        }}
      >
        <Brand />
        <View
          style={{
            ...row,
            gap: 2,
            backgroundColor: "#ebefe5",
            borderRadius: 24,
            padding: 3,
          }}
        >
          {["Analyzer", "Dashboard", "Account"].map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={p}
              onPress={() => go(p)}
              accessibilityState={{ selected: page === p }}
              style={{
                paddingHorizontal: wide ? 18 : 10,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: page === p ? "#fff" : "transparent",
              }}
            >
              <T
                style={{
                  color: page === p ? ink : muted,
                  fontSize: wide ? 15 : 13,
                  fontWeight: page === p ? "700" : "500",
                }}
              >
                {p}
              </T>
            </Pressable>
          ))}
        </View>
      </View>
      <View
        style={{
          width: "100%",
          maxWidth: 1240,
          alignSelf: "center",
          padding: wide ? 36 : 16,
          gap: 18,
        }}
      >
        <WorkspaceHeader {...{ page, wide, result }} />
        {message && (
          <T
            accessibilityLiveRegion="polite"
            testID="message"
            style={{ backgroundColor: "#fff1d9", padding: 12 }}
          >
            {message}
          </T>
        )}
        {busy && <T>Working…</T>}
        {page === "Analyzer" && (
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            <View style={[card, { flex: 1.15 }]}>
              <View style={{ ...row, justifyContent: "space-between" }}>
                {title("Sequence input")}
                {!raw.trim() && (
                  <B
                    title="Use example"
                    onPress={() => {
                      edit(example);
                      N("Example sequence");
                    }}
                  />
                )}
              </View>
              <Input
                label="Sequence name"
                placeholder="Untitled sequence"
                maxLength={200}
                value={name}
                onChangeText={N}
              />
              <Input
                label="DNA sequence"
                placeholder={">sample_01\nACGT…"}
                value={raw}
                multiline
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={edit}
                style={{
                  minHeight: 148,
                  letterSpacing: 1.6,
                  lineHeight: 24,
                  textAlignVertical: "top",
                  fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                }}
              />
              <T style={{ color: muted }}>
                FASTA or TXT · One record · Up to 100,000 bases
              </T>
              <View style={row}>
                {action(
                  "Analyze",
                  () => {
                    Q(analyze(raw));
                    V(false);
                  },
                  true,
                )}
                {action("Import file", async () => {
                  const f = await pick();
                  if (!f) return;
                  validateFile(f.name, f.size);
                  edit(await f.text());
                  F(f);
                  N(f.name);
                })}
                {action("Clear", () => {
                  edit("");
                  N("");
                })}
              </View>
              {file && <T>{file.name}</T>}
            </View>
            <View style={[card, { flex: 1 }]}>
              {title("Analysis results")}
              {!result ? (
                <View
                  style={{
                    flex: 1,
                    minHeight: 198,
                    backgroundColor: "#f5f7ef",
                    borderRadius: 12,
                    padding: 22,
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {Object.entries(baseColors).map(([base, color]) => (
                      <View
                        key={base}
                        style={{
                          backgroundColor: color,
                          paddingHorizontal: 11,
                          paddingVertical: 8,
                          borderRadius: 7,
                        }}
                      >
                        <T style={{ fontWeight: "700" }}>{base}</T>
                      </View>
                    ))}
                  </View>
                  <T style={{ fontWeight: "700", fontSize: 18 }}>
                    Awaiting sequence
                  </T>
                  <T
                    style={{
                      color: muted,
                      maxWidth: 270,
                      textAlign: "center",
                      lineHeight: 21,
                    }}
                  >
                    Select Analyze to see composition, ratios and the reverse
                    complement.
                  </T>
                </View>
              ) : (
                <>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {Object.entries({
                      "Sequence length": result.length,
                      "GC content":
                        fmt(result.gc) + (result.gc === null ? "" : "%"),
                      "AT content":
                        fmt(result.at) + (result.at === null ? "" : "%"),
                      "Ambiguous bases": result.ambiguous,
                      "AT/GC ratio": fmt(result.ratio),
                    }).map(([k, v]) => (
                      <View
                        key={k}
                        style={{
                          flexGrow: 1,
                          minWidth: 122,
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: "#f1f4ed",
                        }}
                      >
                        <T
                          testID={k}
                          accessibilityLabel={k + " " + v}
                          style={{ color: muted, fontSize: 13 }}
                        >
                          {k}
                          {"\n"}
                          <Text
                            style={{
                              color: ink,
                              fontSize: 22,
                              fontWeight: "700",
                            }}
                          >
                            {v}
                          </Text>
                        </T>
                      </View>
                    ))}
                  </View>
                  {title("Nucleotide distribution")}
                  {Object.entries(result.counts)
                    .filter(([b, n]) => "ACGT".includes(b) || n)
                    .map(([b, n]) => (
                      <View key={b}>
                        <T testID={"count-" + b}>
                          {b} {n} · {fmt(result.frequencies[b] * 100)}%
                        </T>
                        <View style={{ height: 5, backgroundColor: "#e7eeea" }}>
                          <View
                            style={{
                              height: 5,
                              width: result.frequencies[b] * 100 + "%",
                              backgroundColor: baseColors[b] || green,
                            }}
                          />
                        </View>
                      </View>
                    ))}
                  <T style={{ fontWeight: "bold" }}>Reverse complement</T>
                  <T
                    testID="reverse"
                    selectable
                    style={{
                      backgroundColor: "#f3f5ec",
                      padding: 12,
                      borderRadius: 8,
                      fontFamily:
                        Platform.OS === "ios" ? "Courier" : "monospace",
                    }}
                  >
                    {result.reverse}
                  </T>
                  <T>{result.timestamp}</T>
                  <T style={{ color: muted }}>
                    GC and AT percentages use canonical bases. Frequencies use
                    all positions. A zero denominator is undefined.
                  </T>
                  <View style={row}>
                    {action(
                      saved ? "Saved" : "Save analysis",
                      async () => {
                        if (saved) return;
                        if (!session) {
                          go("Account");
                          return;
                        }
                        await save(db, name, result, file, raw);
                        V(true);
                      },
                      true,
                    )}
                    {action("Export JSON", () => download(result))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}
        {page === "Account" && (
          <View
            style={[
              card,
              { maxWidth: 520, width: "100%", alignSelf: "center" },
            ]}
          >
            {session ? (
              <>
                <T>{session.user.email}</T>
                {action("Sign out", async () => {
                  const { error } = await db.auth.signOut();
                  if (error) throw error;
                })}
              </>
            ) : (
              <>
                {title(mode)}
                {mode === "Register" && <Input label="Display name" maxLength={120} value={displayName} onChangeText={setDisplayName} />}
<Input
                    label="Email"
                    value={email}
                    onChangeText={E}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                <>
                    <Input
                      label="Password"
                      secureTextEntry={!show}
                      value={pass}
                      onChangeText={P}
                    />
                    <B
                      title={show ? "Hide password" : "Show password"}
                      onPress={() => S(!show)}
                    />
                  </>
                {mode === "Register" && (
                  <Input
                    label="Confirm password"
                    secureTextEntry={!show}
                    value={confirm}
                    onChangeText={C}
                  />
                )}
                {action(mode, auth, true)}
                <View style={row}>
                  {["Sign in", "Register"]
                    .filter((m) => m !== mode)
                    .map((m) => (
                      <B
                        key={m}
                        title={m}
                        onPress={() => {
                          setMode(m);
                          S(false);
                          P("");
                          C("");
                          M("");
                        }}
                      />
                    ))}
                </View>
              </>
            )}
          </View>
        )}
        {page === "Dashboard" && session && !stats && (
          <View style={card}>
            {message ? (
              <B
                title="Retry dashboard"
                onPress={() => {
                  M("");
                  setReload(reload + 1);
                }}
              />
            ) : (
              <T accessibilityLiveRegion="polite">
                Loading analysis history...
              </T>
            )}
          </View>
        )}
        {page === "Dashboard" && session && stats && (
          <View style={card}>
            {title("Analysis overview")}
            <T>Total saved analyses · {stats.total}</T>
            <T>Total uploaded sequences · {stats.uploaded}</T>
            {title("Recent activity")}
            <T>
              Latest {records.length} saved analyses ·{" "}
              {records.filter((r) => r.uploaded_files.length).length} imported
            </T>
            <T>
              Canonical counts ·{" "}
              {Object.entries(totals)
                .map(([k, v]) => k + " " + v)
                .join("   ")}
            </T>
            {canonicalTotal > 0 && (
              <T>
                GC across recent canonical bases{" "}
                {fmt((100 * (totals.G + totals.C)) / canonicalTotal)}%
              </T>
            )}
            {records.length === 0 ? (
              <T>Your saved analyses will appear here.</T>
            ) : (
              records.map((r) => (
                <View
                  key={r.id}
                  style={{
                    borderTopWidth: 1,
                    borderColor: line,
                    paddingTop: 12,
                  }}
                >
                  <T>
                    {r.dna_sequences.name} · {fmt(r.gc)} GC% · {r.created_at}
                  </T>
                  <T>{r.owner?.display_name} · {r.owner?.email} · {Object.values(r.composition).reduce((sum, n) => sum + n, 0)} bases · {r.uploaded_files?.[0]?.filename || "Pasted sequence"}</T>
<B
                    title="Open analysis"
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        const bases = await loadSequence(db, r.sequence_id);
                        edit(bases);
                        N(r.dna_sequences.name);
                        Q({
                          ...analyze(bases),
                          timestamp: r.created_at,
                        });
                        V(true);
                        nav("Analyzer");
                      })
                    }
                  />
                </View>
              ))
            )}
            <B
              title="New analysis"
              onPress={() => {
                edit("");
                N("");
                nav("Analyzer");
              }}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
export class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <T>
        GeneScan could not display this screen. Restart the application to
        recover.
      </T>
    ) : (
      this.props.children
    );
  }
}
