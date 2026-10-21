import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { TimeTreeAPIClient } from '../.test-dist/client/api.js';
import { downloadCommentImage } from '../.test-dist/utils/comment-image.js';
import { createGetEventCommentImageTool, createListEventCommentsTool } from '../.test-dist/tools/comment-tools.js';
import { toolResult } from '../.test-dist/tools/index.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64');
const image = { object_key: 'calendar/example.png', filename: 'example.png', width: 1, height: '1', private_field: 'hidden' };
const comment = { id: 'image-comment', type: 0, attachment: { content: null, images: [image] } };
const args = { calendar_id: '123', event_uuid: 'event-1', comment_id: comment.id };
const makeClient = (activities = [comment]) => new TimeTreeAPIClient({
  isAuthenticated: () => true,
  getHttpClient: () => ({ get: async () => ({ event_activities: activities }) }),
});

test('comment listing includes image-only comments and bounded metadata without download locations', async () => {
  const tool = createListEventCommentsTool(makeClient([
    comment,
    { id: 'text-comment', type: 0, attachment: { content: 'hello' } },
    { id: 'null-images', type: 0, attachment: { images: null } },
    { id: 'deleted', type: 0, attachment: { images: [image] }, deactivated_at: 1 },
    { id: 'system', type: 1, attachment: { images: [image] } },
  ]));
  const result = toolResult(tool, await tool.handler(args));
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.total, 3);
  assert.equal(result.structuredContent.comments[0].content, '');
  assert.deepEqual(result.structuredContent.comments[0].images, [
    { image_index: 0, filename: 'example.png', width: 1, height: '1' },
  ]);
  assert.deepEqual(result.structuredContent.comments[1].images, []);
  assert.deepEqual(result.structuredContent.comments[2].images, []);
  assert.doesNotMatch(JSON.stringify(result), /object_key|calendar\/example|private_field|hidden/);
});

test('image tool resolves an authorized comment, rate limits both reads, and returns valid MCP image content', async (t) => {
  const client = makeClient();
  let requests = 0;
  t.mock.method(client.rateLimiter, 'executeWithRetry', async (fn) => { requests++; return fn(); });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, 'https://attachments.timetreeapp.com/calendar/example.png');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(png, { headers: { 'content-type': 'application/octet-stream' } });
  });
  const tool = createGetEventCommentImageTool(client);
  const result = toolResult(tool, await tool.handler(args));
  assert.equal(result.isError, undefined);
  assert.equal(requests, 2);
  assert.deepEqual(result.structuredContent, {
    calendar_id: 123, event_uuid: 'event-1', comment_id: comment.id,
    image_index: 0, filename: 'example.png', width: 1, height: '1', mime_type: 'image/png', byte_size: png.length,
  });
  assert.deepEqual(result.content[1], { type: 'image', data: png.toString('base64'), mimeType: 'image/png' });
  assert.ok(CallToolResultSchema.safeParse(result).success);
  assert.doesNotMatch(JSON.stringify(result.structuredContent), /object_key|calendar\/example|private_field/);
});

test('an explicit image index selects the requested attachment', async (t) => {
  const client = makeClient([{ ...comment, attachment: { images: [image, { object_key: 'calendar/second.png' }] } }]);
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.pathname, '/calendar/second.png');
    return new Response(png);
  });
  const tool = createGetEventCommentImageTool(client);
  const result = toolResult(tool, await tool.handler({ ...args, image_index: 1 }));
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.image_index, 1);
  assert.equal(result.structuredContent.filename, null);
  assert.equal(result.structuredContent.width, null);
});

test('missing, deleted, and system comments and missing image indices never trigger a download', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected download'); });
  for (const [activities, commentId, index] of [
    [[], comment.id, 0],
    [[{ ...comment, deactivated_at: 1 }], comment.id, 0],
    [[{ ...comment, type: 1 }], comment.id, 0],
    [[comment], 'another-comment', 0],
    [[comment], comment.id, 1],
    [[{ ...comment, attachment: null }], comment.id, 0],
  ]) {
    await assert.rejects(makeClient(activities).getEventCommentImage('123', 'event-1', commentId, index), { statusCode: 404 });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('image inputs reject invalid indices and missing identifiers before reading comments', async () => {
  let reads = 0;
  const tool = createGetEventCommentImageTool({ getEventCommentImage: async () => { reads++; } });
  for (const invalid of [
    { ...args, image_index: -1 }, { ...args, image_index: 0.5 }, { ...args, image_index: '0' },
    { ...args, comment_id: '' }, { ...args, calendar_id: 'bad' }, {},
  ]) {
    const result = toolResult(tool, await tool.handler(invalid));
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
  }
  assert.equal(reads, 0);
});

test('failed calendar access does not download an attachment', async (t) => {
  const client = new TimeTreeAPIClient({
    isAuthenticated: () => true,
    getHttpClient: () => ({ get: async () => { throw new Error('access denied'); } }),
  });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected download'); });
  await assert.rejects(client.getEventCommentImage('123', 'event-1', comment.id, 0), /access denied/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('the download host cannot be changed by an object key', async (t) => {
  const keys = ['//localhost/private.png', 'https://example.com/private.png', '\\localhost\\private.png', 'file:///private.png'];
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.origin, 'https://attachments.timetreeapp.com');
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    return new Response(png);
  });
  for (const key of keys) await downloadCommentImage(key);
});

test('supported image types are identified from bytes rather than names or headers', async (t) => {
  const samples = [
    [png, 'image/png'],
    [Buffer.from([255, 216, 255, 224]), 'image/jpeg'],
    [Buffer.from('GIF87a'), 'image/gif'],
    [Buffer.from('GIF89a'), 'image/gif'],
    [Buffer.from('RIFF1234WEBP'), 'image/webp'],
  ];
  for (const [bytes, expected] of samples) {
    t.mock.method(globalThis, 'fetch', async () => new Response(bytes));
    const result = await downloadCommentImage('calendar/image.unknown');
    assert.equal(result.mimeType, expected);
    assert.deepEqual(result.data, bytes);
    t.mock.restoreAll();
  }
});

test('empty, SVG, and HTML responses fail even when labeled as PNG', async (t) => {
  for (const body of ['', '<svg xmlns="http://www.w3.org/2000/svg"/>', '<html>sign in</html>']) {
    t.mock.method(globalThis, 'fetch', async () => new Response(body, { headers: { 'content-type': 'image/png' } }));
    await assert.rejects(downloadCommentImage('calendar/image.png'), { statusCode: 415 });
    t.mock.restoreAll();
  }
});

test('oversized Content-Length cancels the body without reading it', async (t) => {
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    cancel() { cancelled = true; },
  }), { headers: { 'content-length': String(5 * 1024 * 1024 + 1) } }));
  await assert.rejects(downloadCommentImage('calendar/image.png'), { statusCode: 413 });
  assert.equal(cancelled, true);
});

test('streamed image size is bounded even with a missing or misleading Content-Length', async (t) => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    let cancelled = false;
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
      cancel() { cancelled = true; },
    }), { headers }));
    await assert.rejects(downloadCommentImage('calendar/image.png'), { statusCode: 413 });
    assert.equal(cancelled, true);
    t.mock.restoreAll();
  }
});

for (const stage of ['headers', 'body']) {
  test(`comment image deadline aborts stalled response ${stage}`, { timeout: 3000 }, async (t) => {
    const controller = new AbortController();
    const reason = new DOMException('Test download deadline reached', 'TimeoutError');
    const deadline = t.mock.method(AbortSignal, 'timeout', () => controller.signal);
    const server = createServer((_request, response) => {
      if (stage === 'headers') {
        controller.abort(reason);
      } else {
        response.writeHead(200, { 'content-type': 'image/png' });
        response.write(png.subarray(0, 8));
      }
    });
    t.after(() => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const fetchImage = globalThis.fetch;
    let receivedHeaders = false;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      const response = await fetchImage(`http://127.0.0.1:${server.address().port}/`, options);
      receivedHeaders = true;
      setImmediate(() => controller.abort(reason));
      return response;
    });
    const tool = createGetEventCommentImageTool(makeClient());
    const result = toolResult(tool, await tool.handler(args));
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.ok(result.content.every((content) => content.type === 'text'));
    assert.match(result.content[0].text, /Could not download the comment image/);
    assert.equal(receivedHeaders, stage === 'body');
    assert.equal(controller.signal.aborted, true);
    assert.deepEqual(deadline.mock.calls.map((call) => call.arguments), [[30_000]]);
  });
}

test('HTTP and network errors never return upstream bodies or image locations', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('private upstream body', { status: 403 }));
  await assert.rejects(downloadCommentImage('calendar/private-key.png'), { statusCode: 403, message: 'Image download failed (HTTP 403).' });
  t.mock.restoreAll();
  for (const name of ['TypeError', 'TimeoutError']) {
    t.mock.method(globalThis, 'fetch', async () => {
      const error = new Error('https://attachments.timetreeapp.com/calendar/private-key.png');
      error.name = name;
      throw error;
    });
    const tool = createGetEventCommentImageTool(makeClient());
    const result = toolResult(tool, await tool.handler(args));
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.doesNotMatch(JSON.stringify(result), /private-key|attachments\.timetreeapp|private upstream body/);
    t.mock.restoreAll();
  }
});
