/**
 * Isolated Request Handler Unit Tests
 *
 * Tests the HTTP request handler callback from server.js in complete isolation —
 * no network I/O, no server binding, no Supertest. Uses mock req and res objects
 * with jest.fn() stubs to verify the handler's behavior at the function level.
 *
 * Handler extraction strategy: Mock http.createServer via jest.spyOn BEFORE
 * requiring server.js, so the anonymous callback is captured when the module
 * executes http.createServer(handler). A mock server object with listen/on/address
 * methods is returned to prevent actual server creation.
 *
 * @module __tests__/server.handler.test.js
 * @see server.js lines 6-9
 */

'use strict';

const http = require('http');

// ---------------------------------------------------------------------------
// Expected values — named constants for all assertions (no magic strings/numbers)
// ---------------------------------------------------------------------------
const EXPECTED_STATUS_CODE = 200;
const EXPECTED_CONTENT_TYPE = 'text/plain';
const EXPECTED_BODY = 'Hello, World!\n';

// ---------------------------------------------------------------------------
// Module-level variables populated in beforeAll
// ---------------------------------------------------------------------------
let handler; // The anonymous (req, res) => { ... } callback from server.js
let mockServer; // Fake http.Server returned by the mocked createServer

// ---------------------------------------------------------------------------
// Lifecycle hooks — mock http.createServer to capture the handler
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Create a mock server object that exposes every method server.js invokes.
  // server.js calls: server.listen(port, hostname, cb)
  // The mock immediately invokes the listen callback so console.log fires.
  mockServer = {
    listen: jest.fn((port, hostname, cb) => {
      if (typeof cb === 'function') {
        cb(); // invoke the listen callback synchronously
      }
    }),
    on: jest.fn(),
    address: jest.fn(() => ({ address: '127.0.0.1', port: 3000 })),
    close: jest.fn((cb) => {
      if (typeof cb === 'function') {
        cb();
      }
    }),
  };

  // Spy on http.createServer to intercept the handler and return the mock.
  // This MUST happen before require('../server') so the spy is in place.
  jest.spyOn(http, 'createServer').mockImplementation((requestHandler) => {
    handler = requestHandler;
    return mockServer;
  });

  // Suppress console.log output from the server startup message.
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // Require server.js — this triggers http.createServer(handler) and
  // mockServer.listen(port, hostname, cb), populating the handler variable.
  require('../server');
});

afterAll(() => {
  // Restore all spies (http.createServer, console.log) to their originals.
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test Suite — Request Handler
// ---------------------------------------------------------------------------

describe('Request Handler', () => {
  // Sanity guard: confirm the handler was captured before any tests run.
  test('should have been captured from http.createServer', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  // -----------------------------------------------------------------------
  // Test 3.1: Status code assignment
  // -----------------------------------------------------------------------
  test('should set res.statusCode to 200', () => {
    const req = {};
    const res = {
      statusCode: null,
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    handler(req, res);

    expect(res.statusCode).toBe(EXPECTED_STATUS_CODE);
    expect(res.end).toHaveBeenCalled(); // confirm handler completed
  });

  // -----------------------------------------------------------------------
  // Test 3.2: Content-Type header
  // -----------------------------------------------------------------------
  test('should call res.setHeader with Content-Type text/plain', () => {
    const req = {};
    const res = {
      statusCode: null,
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    handler(req, res);

    expect(res.setHeader).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', EXPECTED_CONTENT_TYPE);
  });

  // -----------------------------------------------------------------------
  // Test 3.3: Response body
  // -----------------------------------------------------------------------
  test('should call res.end with "Hello, World!\\n"', () => {
    const req = {};
    const res = {
      statusCode: null,
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    handler(req, res);

    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalledWith(EXPECTED_BODY);
  });

  // -----------------------------------------------------------------------
  // Test 3.4: Handler ignores the req object entirely (Proxy-based)
  // -----------------------------------------------------------------------
  test('should not read any property from the req object', () => {
    // Track every property access on req using a Proxy get trap.
    const propertyAccesses = [];
    const req = new Proxy(
      {},
      {
        get: (_target, prop) => {
          propertyAccesses.push(String(prop));
          return undefined;
        },
      },
    );
    const res = {
      statusCode: null,
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    handler(req, res);

    // The handler should never read anything from req — the array stays empty.
    expect(propertyAccesses).toEqual([]);
    // Confirm the handler still executed correctly despite the Proxy wrapper.
    expect(res.end).toHaveBeenCalledWith(EXPECTED_BODY);
  });

  // -----------------------------------------------------------------------
  // Test 3.5: Synchronous execution — no Promise returned
  // -----------------------------------------------------------------------
  test('should execute synchronously without returning a promise', () => {
    const req = {};
    const res = {
      statusCode: null,
      setHeader: jest.fn(),
      end: jest.fn(),
    };

    const result = handler(req, res);

    // The handler is a plain synchronous arrow function — returns undefined.
    expect(result).toBeUndefined();
    // All mock interactions happened immediately (synchronously).
    expect(res.statusCode).toBe(EXPECTED_STATUS_CODE);
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Test 3.6: Invocation order — statusCode → setHeader → end
  // -----------------------------------------------------------------------
  test('should call res methods in order: statusCode, setHeader, end', () => {
    const callOrder = [];
    const req = {};
    const res = {
      // Use a setter to detect when statusCode is assigned.
      set statusCode(_val) {
        callOrder.push('statusCode');
      },
      get statusCode() {
        return null;
      },
      setHeader: jest.fn(() => {
        callOrder.push('setHeader');
      }),
      end: jest.fn(() => {
        callOrder.push('end');
      }),
    };

    handler(req, res);

    expect(callOrder).toEqual(['statusCode', 'setHeader', 'end']);
    // Redundant length check ensures the array has exactly 3 entries.
    expect(callOrder).toHaveLength(3);
  });

  // -----------------------------------------------------------------------
  // Test 3.7: Identical output regardless of req contents
  // -----------------------------------------------------------------------
  test('should produce identical output regardless of req contents', () => {
    const requests = [
      {},
      { method: 'GET', url: '/' },
      { method: 'POST', url: '/foo', headers: { 'content-type': 'application/json' } },
      { method: 'DELETE', url: '/bar/baz?query=value' },
      { method: 'PUT', url: '/update', headers: { authorization: 'Bearer token' } },
      { method: 'PATCH', url: '/partial' },
      { method: 'OPTIONS', url: '/' },
      { method: 'HEAD', url: '/' },
    ];

    requests.forEach((req) => {
      const res = {
        statusCode: null,
        setHeader: jest.fn(),
        end: jest.fn(),
      };

      handler(req, res);

      expect(res.statusCode).toBe(EXPECTED_STATUS_CODE);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', EXPECTED_CONTENT_TYPE);
      expect(res.end).toHaveBeenCalledWith(EXPECTED_BODY);
    });
  });
});
