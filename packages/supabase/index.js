import { createClient } from "@supabase/supabase-js";
// The SDK requires a nonempty constructor argument. This public transport
// marker is removed before requests leave either client.
export function client(url, options) {
  if (!url) return null;
  const marker = "genescan-gateway";
  return createClient(url, marker, {
    auth: options,
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("apikey");
        if (headers.get("Authorization") === "Bearer " + marker)
          headers.delete("Authorization");
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export function resolveMobileGatewayUrl(url, scriptUrl, platform) {
  if (!url) return null;
  let gateway;
  try {
    gateway = new URL(url);
  } catch {
    return url;
  }
  if (!["localhost", "127.0.0.1"].includes(gateway.hostname)) return url;
  let host;
  if (scriptUrl) {
    try {
      host = new URL(scriptUrl).hostname;
    } catch {
      host = null;
    }
  }
  if (!host && platform === "android") host = "10.0.2.2";
  if (!host) return gateway.toString();
  gateway.hostname = host;
  return gateway.toString();
}
const pendingArchives = new WeakMap();

export async function save(db, name, result, file, raw = result.sequence) {
  const { data, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  let folder = pendingArchives.get(result);
  if (!folder) {
    folder = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    pendingArchives.set(result, folder);
  }
  const filename = file?.name || null;
  const label = name.trim() || "Untitled sequence";
  const prefix = data.user.id + "/" + folder + "/";
  const storage = db.storage.from("genescan-private");
  const extension = filename?.split(".").pop().toLowerCase() || "txt";
  const source = file ? await file.arrayBuffer() : raw;
  const sourceKey = "source." + extension;
  const report = JSON.stringify({ name: label, filename, sourceKey, ...result });
  for (const [key, body, contentType] of [
    [sourceKey, source, "text/plain"], ["analysis.json", report, "application/json"],
  ]) {
    const { error } = await storage.upload(prefix + key, body, { contentType, upsert: true });
    if (error) throw error;
  }
  const { error } = await db.rpc("save_archived_analysis", {
    label, bases: result.sequence, filename, folder,
  });
  if (error) throw error;
}
export async function history(db) {
  const [analyses, profile] = await Promise.all([
    db.from("sequence_analyses").select("id,sequence_id,created_at,gc,composition,dna_sequences(name),uploaded_files(filename)").order("created_at", { ascending: false }).limit(100),
    db.from("profiles").select("display_name,email").maybeSingle(),
  ]);
  if (analyses.error || profile.error) throw analyses.error || profile.error;
  return analyses.data.map(row => ({ ...row, owner: profile.data }));
}

export async function loadSequence(db, id) {
  const { data, error } = await db
    .from("dna_sequences")
    .select("bases")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data.bases;
}
