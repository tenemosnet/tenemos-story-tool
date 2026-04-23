// 週次自動記事生成 Cron Worker
// Cron Triggerで起動し、Service Binding経由で本体APIを呼び出す

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(triggerWeeklyGenerate(env));
  },

  // 手動テスト用のfetchハンドラ
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/trigger') {
      try {
        const result = await triggerWeeklyGenerate(env);
        return new Response(JSON.stringify({ triggered: true, result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response('Cron Worker is running. Use /trigger to test.', { status: 200 });
  },
};

async function triggerWeeklyGenerate(env) {
  // Service Binding経由で本体Workerに直接リクエスト
  const res = await env.STORY_TOOL.fetch(
    new Request('https://dummy-host/api/cron/weekly-generate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
      },
    })
  );

  const body = await res.text();
  console.log(`Response (${res.status}): ${body}`);

  if (!res.ok) {
    throw new Error(`Weekly generate failed: ${res.status} ${body}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}
