// A stand-in for the OpenAI Images API, so the e2e suite can generate images
// without a key or a bill. The dev server reaches it via MOSAGE_OPENAI_BASE_URL.
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';

const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
// Keep in step with MOCK_OPENAI_KEY in tests/helpers.ts.
const MOCK_KEY = 'sk-e2e-0123456789abcdefghij';

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(width, height, [r, g, b]) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0)]);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200).end('ok');
    return;
  }
  if (req.method !== 'POST' || req.url !== '/v1/images/generations') {
    res.writeHead(404).end();
    return;
  }
  if (req.headers.authorization !== `Bearer ${MOCK_KEY}`) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }));
    return;
  }
  let body = '';
  req.on('data', (c) => {
    body += c;
  });
  req.on('end', () => {
    const { prompt = '' } = JSON.parse(body || '{}');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        data: [{ b64_json: png(48, 32, [37, 99, 235]).toString('base64') }],
        usage: {
          input_tokens: 20 + prompt.length,
          output_tokens: 1056,
          total_tokens: 1076 + prompt.length,
          input_tokens_details: { text_tokens: 20 + prompt.length, image_tokens: 0 },
        },
      }),
    );
  });
}).listen(port, '127.0.0.1');
