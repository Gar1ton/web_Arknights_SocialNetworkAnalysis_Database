import { parseReport } from "../../src/report/report";

interface Env {
  DB: D1Database;
}
const site = "https://gar1ton.github.io";
/** Site-wide reports per hour; keeps a flood inside D1's free daily writes. */
const hourlyCap = 800;
const reply = (status: number) =>
  new Response(null, {
    status,
    headers: { "Access-Control-Allow-Origin": site },
  });

/** Write-only: no request can read reports back. */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "POST") return reply(405);
  // Read only to stop other sites posting; it is never stored.
  if (request.headers.get("Origin") !== site) return reply(403);
  const text = await request.text();
  if (text.length > 16_000) return reply(413);
  const report = parseReport(text);
  if (!report) return reply(400);
  const now = new Date().toISOString();
  const hour = now.slice(0, 13);
  const used = await env.DB.prepare("SELECT n FROM quota WHERE hour = ?")
    .bind(hour)
    .first<number>("n");
  if ((used ?? 0) >= hourlyCap) return reply(429);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO reports (id, created_at, type, archive, data_version, body) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      crypto.randomUUID(),
      now,
      report.type,
      report.archive,
      report.dataVersion,
      JSON.stringify(report),
    ),
    env.DB.prepare(
      "INSERT INTO quota (hour, n) VALUES (?, 1) ON CONFLICT (hour) DO UPDATE SET n = n + 1",
    ).bind(hour),
  ]);
  return reply(201);
};
