import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import fs from "node:fs";
const db = new PGlite();
try {
  await db.exec(
    "create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;",
  );
  for (const file of fs.readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  }
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  await db.query("insert into auth.users(id) values($1),($2)", [a, b]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  await db.query("select public.save_analysis('sample','ACGN','sample.fa')");
  for (const t of [
    "profiles",
    "sequence_analyses",
    "uploaded_files",
    "dna_sequences",
    "analysis_history",
  ])
    assert.equal((await db.query("select * from " + t)).rows.length, 1);
  const r = (await db.query("select * from sequence_analyses")).rows[0];
  assert.ok(Math.abs(r.gc - 200 / 3) < 1e-10);
  await assert.rejects(
    db.query("select public.save_analysis('bad','AT','bad.exe')"),
  );
  assert.equal((await db.query("select * from dna_sequences")).rows.length, 1);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
  for (const t of [
    "genescan_activity",
    "sequence_analyses",
    "uploaded_files",
    "dna_sequences",
    "analysis_history",
  ])
    assert.equal((await db.query("select * from " + t)).rows.length, 0);
  assert.equal((await db.query("select id from profiles")).rows[0].id,b);
  await db.exec("reset role;set role anon");
  await assert.rejects(
    db.query("select public.save_analysis('sample','AT',null)"),
  );
  console.log(
    "PASS migration, authenticated save, five ownership policies, GC denominator, failed-write rollback and anonymous RPC denial (embedded PostgreSQL).",
  );
} finally {
  await db.close();
}
