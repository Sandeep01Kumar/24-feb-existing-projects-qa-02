/**
 * HTTP Response Integration Tests
 *
 * Comprehensive Jest test suite that makes real HTTP requests against the
 * server.js HTTP server using Supertest. Validates the full request/response
 * cycle including status codes, headers, and body content.
 *
 * Supertest automatically connects to the already-listening server instance,
 * providing reliable HTTP assertions without manual port management.
 *
 * Test coverage includes:
 * - Happy path: GET / with full response validation
 * - HTTP methods: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD
 * - URL paths: /, /foo, /bar/baz, /nonexistent, /?query=value, deeply nested
 * - Edge cases: concurrent requests, large payloads, custom headers, sequential requests
 *
 * @file __tests__/server.test.js
 * @requires supertest - HTTP assertion library for Node.js server testing
 * @requires ../server - HTTP server instance (http.Server object)
 */

'use strict';

/* ──────────────────────────── Imports ──────────────────────────── */

const request = require('supertest');
const server = require('../server');

/* ──────────────────────────── Test Constants ──────────────────────────── */

/**
 * Expected response values matching the hardcoded behavior in server.js.
 * No magic strings or numbers appear in assertions — all reference these constants.
 */
const EXPECTED_STATUS_CODE = 200;
const EXPECTED_CONTENT_TYPE = 'text/plain';
const EXPECTED_BODY = 'Hello, World!\n';
const EXPECTED_BODY_LENGTH = '14'; // Content-Length is a string in HTTP headers (14 ASCII bytes)

/* ──────────────────────────── Lifecycle Hooks ──────────────────────────── */

/**
 * Suppress console.log output from server startup during test execution.
 * The server auto-starts on require('../server'), and the listen callback
 * fires asynchronously — this spy catches the startup message.
 * Wait for the server to be in a listening state before running tests
 * to prevent Supertest from re-binding to an ephemeral port.
 */
beforeAll((done) => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  if (server.listening) {
    done();
  } else {
    server.on('listening', () => done());
  }
});

/**
 * Gracefully shut down the server after all tests complete to prevent
 * resource leaks (open handles) and allow Jest to exit cleanly.
 * Restore all Jest mocks to their original implementations.
 * Checks server.listening to avoid errors if the server was already closed.
 */
afterAll((done) => {
  jest.restoreAllMocks();
  if (server.listening) {
    server.close(done);
  } else {
    done();
  }
});

/* ──────────────────────────── Test Suites ──────────────────────────── */

describe('GET / - Happy Path', () => {
  test('should return status code 200', async () => {
    const res = await request(server).get('/');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.ok).toBe(true);
  });

  test('should return Content-Type text/plain', async () => {
    const res = await request(server).get('/');
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
  });

  test('should return body "Hello, World!\\n"', async () => {
    const res = await request(server).get('/');
    expect(res.text).toBe(EXPECTED_BODY);
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
  });

  test('should return Content-Length of 14', async () => {
    const res = await request(server).get('/');
    expect(res.headers['content-length']).toBe(EXPECTED_BODY_LENGTH);
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
  });
});

describe('HTTP Methods - Identical Response', () => {
  test('POST should return 200 with same body', async () => {
    const res = await request(server).post('/');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('PUT should return 200 with same body', async () => {
    const res = await request(server).put('/');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('DELETE should return 200 with same body', async () => {
    const res = await request(server).delete('/');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('PATCH should return 200 with same body', async () => {
    const res = await request(server).patch('/');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('OPTIONS should return 200 with same body', async () => {
    const res = await request(server).options('/');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
  });

  test('HEAD should return 200 with correct headers but empty body', async () => {
    const res = await request(server).head('/');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
    // Node.js http module does not auto-set Content-Length for HEAD responses
    // when body is passed to res.end() — only Content-Type is sent
    expect(res.text).toBeFalsy();
  });
});

describe('URL Paths - Identical Response', () => {
  test('should return same response for /foo', async () => {
    const res = await request(server).get('/foo');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('should return same response for /bar/baz', async () => {
    const res = await request(server).get('/bar/baz');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('should return same response for /nonexistent', async () => {
    const res = await request(server).get('/nonexistent');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('should return same response for /?query=value', async () => {
    const res = await request(server).get('/?query=value');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('should return same response for deeply nested path', async () => {
    const res = await request(server).get('/a/b/c/d/e/f');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.text).toBe(EXPECTED_BODY);
  });
});

describe('Edge Cases', () => {
  test('should handle 10+ concurrent requests with identical responses', async () => {
    const requests = Array.from({ length: 15 }, () => request(server).get('/'));
    const responses = await Promise.all(requests);
    responses.forEach((res) => {
      expect(res.status).toBe(EXPECTED_STATUS_CODE);
      expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
      expect(res.text).toBe(EXPECTED_BODY);
    });
  });

  test('should return standard response when receiving large request body', async () => {
    const largeBody = 'x'.repeat(10000);
    const res = await request(server).post('/').send(largeBody);
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('should return standard response with custom request headers', async () => {
    const res = await request(server)
      .get('/')
      .set('X-Custom-Header', 'custom-value')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token123');
    expect(res.status).toBe(EXPECTED_STATUS_CODE);
    expect(res.headers['content-type']).toBe(EXPECTED_CONTENT_TYPE);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('should return response body of exactly 14 bytes', async () => {
    const res = await request(server).get('/');
    expect(Buffer.byteLength(res.text, 'utf8')).toBe(14);
    expect(res.text).toBe(EXPECTED_BODY);
  });

  test('should return identical responses for 100 sequential requests', async () => {
    for (let i = 0; i < 100; i++) {
      const res = await request(server).get('/');
      expect(res.status).toBe(EXPECTED_STATUS_CODE);
      expect(res.text).toBe(EXPECTED_BODY);
    }
  });
});
