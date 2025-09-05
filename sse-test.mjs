// sse-fetch.mjs
const url = 'https://jake-m3-air.meerkat-hammerhead.ts.net/api/v1/usage/stream';

const res = await fetch(url, {
  method: 'GET',
  headers: {
    Authorization: 'Bearer csai-o-sw7f369sl523x30u367i5nelc5u9suax',
    Accept: 'text/event-stream',
    // Optional sanity: 'User-Agent': 'node-fetch'
  },
});

console.log('HTTP', res.status, res.statusText);
for (const [k, v] of res.headers) console.log('↩', k, v);

if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });

  // naive SSE parse: split on blank lines
  const parts = buf.split('\n\n');
  buf = parts.pop() ?? '';
  for (const chunk of parts) {
    const data = chunk
      .split('\n')
      .filter(l => l.startsWith('data:'))
      .map(l => l.slice(5).trim())
      .join('\n');
    if (data) console.log('📨', data);
  }
}
