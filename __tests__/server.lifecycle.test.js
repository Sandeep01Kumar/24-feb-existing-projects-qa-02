/**
 * Server Lifecycle Tests
 *
 * Validates the complete lifecycle of the HTTP server defined in server.js:
 * - Server startup and console output via child process spawning (Strategy C)
 * - Server binding address and port verification
 * - Console.log output verification via Jest spies
 * - Graceful shutdown behavior
 * - EADDRINUSE port conflict error handling
 * - Server error event propagation and http.Server instance verification
 *
 * Uses Node.js built-in modules (net, child_process, path, http) and the
 * server instance from require('../server'). Does NOT use Supertest — this
 * file focuses exclusively on lifecycle concerns, not HTTP response content.
 *
 * @file __tests__/server.lifecycle.test.js
 * @requires net - For creating temporary TCP servers to simulate EADDRINUSE
 * @requires child_process - For spawning server.js as isolated child processes
 * @requires path - For resolving absolute path to server.js
 * @requires http - For instanceof verification of the server object
 */

'use strict';

/* ──────────────────────────── Imports ──────────────────────────── */

const net = require('net');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');

/* ──────────────────────────── Test Constants ──────────────────────────── */

/**
 * Expected server configuration values matching the hardcoded constants
 * in server.js. Used across all test suites for assertion consistency.
 * No magic strings or numbers appear in assertions — all reference these constants.
 */
const EXPECTED_HOSTNAME = '127.0.0.1';
const EXPECTED_PORT = 3000;
const EXPECTED_STARTUP_MESSAGE = `Server running at http://${EXPECTED_HOSTNAME}:${EXPECTED_PORT}/`;
const SERVER_PATH = path.resolve(__dirname, '..', 'server.js');

/**
 * Timeout for child process operations (milliseconds).
 * Child processes that do not respond within this window are forcefully killed.
 */
const CHILD_PROCESS_TIMEOUT = 5000;

/* ──────────────────────────── Helper Functions ──────────────────────────── */

/**
 * Returns a promise that resolves when the given server is in the 'listening' state.
 * Handles the race condition where the server may already be listening
 * by the time this function is called. Also handles the error case (e.g.,
 * EADDRINUSE) by rejecting the promise instead of hanging indefinitely.
 *
 * @param {http.Server} srv - The server instance to wait for
 * @returns {Promise<void>} Resolves when the server is listening, rejects on error
 */
function waitForServerReady(srv) {
  return new Promise((resolve, reject) => {
    if (srv.listening) {
      resolve();
    } else {
      srv.on('listening', resolve);
      srv.on('error', reject);
    }
  });
}

/**
 * Resets Jest's module registry and requires server.js fresh.
 * This ensures each test suite gets an independent server instance that
 * starts its own listen cycle.
 *
 * CRITICAL: Jest intercepts require() calls and maintains its own module cache,
 * separate from Node's require.cache. The commonly-seen pattern of
 * `delete require.cache[require.resolve('../server')]` does NOT work in Jest —
 * it returns the same cached object. jest.resetModules() properly resets Jest's
 * internal module registry so the next require() re-executes the module code
 * and creates a genuinely new server instance.
 *
 * @returns {http.Server} A fresh server instance from server.js
 */
function requireFreshServer() {
  jest.resetModules();
  return require('../server');
}

/**
 * Closes the given server and waits for the OS to fully release the port.
 * Includes a brief delay after the close callback fires to account for
 * Windows port release timing (SO_REUSEADDR / TIME_WAIT behavior).
 *
 * @param {http.Server} srv - The server instance to close
 * @returns {Promise<void>} Resolves when the server is closed and port is released
 */
function closeServerAndRelease(srv) {
  return new Promise((resolve) => {
    if (!srv || !srv.listening) {
      resolve();
      return;
    }
    srv.close(() => {
      // Brief delay for the OS to fully release the socket/port,
      // especially important on Windows where TIME_WAIT can
      // briefly hold the port after server.close() completes
      setTimeout(resolve, 150);
    });
  });
}

/* ──────────── Set global Jest timeout for child process tests ──────────── */

jest.setTimeout(15000);

/* ════════════════════════════════════════════════════════════════════════════
 * Test Suite 1: Server Startup (child process tests)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * These tests spawn server.js as a child process using child_process.fork()
 * to test real startup behavior in isolation without polluting the test process.
 * The child process's stdout, stderr, and exit events are monitored.
 *
 * AAP §0.4.1 Strategy C: "Spawns server.js as a child process to test
 * startup behavior, console output, and graceful shutdown."
 */
describe('Server Startup', () => {
  /**
   * Verifies that the server outputs the expected startup message to stdout.
   * Uses fork() with { silent: true } to capture the child's stdout stream.
   * The startup message format is defined by the console.log call in server.js
   * listen callback (line 13).
   */
  test('should log startup message to stdout', async () => {
    const child = fork(SERVER_PATH, [], { silent: true });

    try {
      const output = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Server did not output startup message within timeout'));
        }, CHILD_PROCESS_TIMEOUT);

        child.stdout.on('data', (data) => {
          clearTimeout(timer);
          resolve(data.toString().trim());
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      // Assert the output matches the exact expected startup message
      expect(output).toBe(EXPECTED_STARTUP_MESSAGE);
      // Assert the output contains the expected hostname as a secondary validation
      expect(output).toContain(EXPECTED_HOSTNAME);
    } finally {
      // Ensure child process is fully killed and port 3000 is released
      // before the next test runs
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await new Promise((resolve) => child.on('exit', resolve));
      }
    }
  });

  /**
   * Verifies that the server process exits cleanly when terminated with SIGTERM.
   * Waits for the server to be fully ready (stdout message) before sending the
   * termination signal, then asserts on the exit code and signal.
   */
  test('should exit cleanly when process is terminated', async () => {
    const child = fork(SERVER_PATH, [], { silent: true });

    try {
      // Set up exit listener BEFORE triggering kill to avoid race condition
      // where the process exits before the listener is attached
      const exitPromise = new Promise((resolve) => {
        child.on('exit', (code, signal) => resolve({ code, signal }));
      });

      // Wait for server to be ready — stdout message indicates the server
      // has bound to the port and is accepting connections
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Server did not start within timeout'));
        }, CHILD_PROCESS_TIMEOUT);

        child.stdout.on('data', () => {
          clearTimeout(timer);
          resolve();
        });
      });

      // Send SIGTERM to trigger graceful shutdown
      child.kill('SIGTERM');

      const { code, signal } = await exitPromise;

      // On Node.js, SIGTERM-terminated processes report signal='SIGTERM' and code=null
      expect(signal).toBe('SIGTERM');
      expect(code).toBeNull();
    } catch (err) {
      // Ensure cleanup on test failure
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
      throw err;
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * Test Suite 2: Server Binding
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Verifies that the server binds to the correct hostname and port.
 * Uses require('../server') to get the server instance directly.
 *
 * CRITICAL lifecycle management (AAP §0.10.3): Since require('../server')
 * starts the server immediately, careful setup/teardown ensures port 3000
 * is properly acquired and released between describe blocks.
 */
describe('Server Binding', () => {
  let server;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    server = requireFreshServer();
    await waitForServerReady(server);
  });

  afterAll(async () => {
    await closeServerAndRelease(server);
    jest.restoreAllMocks();
  });

  /**
   * Verifies server.address() returns the correct hostname and port.
   * Tests TC-004 (server binding to 127.0.0.1:3000) from the tech spec.
   */
  test('should bind to 127.0.0.1 on port 3000', () => {
    const address = server.address();
    expect(address.address).toBe(EXPECTED_HOSTNAME);
    expect(address.port).toBe(EXPECTED_PORT);
  });

  /**
   * Verifies the server is in the listening state after startup completes.
   * The server.listening property and non-null address confirm active binding.
   */
  test('should be in listening state after startup', () => {
    expect(server.listening).toBe(true);
    expect(server.address()).not.toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * Test Suite 3: Console Output
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Verifies that server.js outputs the correct startup message to stdout
 * via console.log. Uses Jest spies to capture and assert on console output.
 *
 * AAP §0.10.1: "Console output management: Use jest.spyOn(console, 'log')
 * .mockImplementation(() => {}) to suppress server startup messages."
 */
describe('Console Output', () => {
  let server;
  let consoleSpy;

  beforeAll(async () => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    server = requireFreshServer();
    await waitForServerReady(server);
  });

  afterAll(async () => {
    await closeServerAndRelease(server);
    consoleSpy.mockRestore();
  });

  /**
   * Verifies console.log was called with the exact expected startup message.
   * Tests TC-005 (startup log message) from the tech spec.
   */
  test('should call console.log with the correct startup message', () => {
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(EXPECTED_STARTUP_MESSAGE);
  });

  /**
   * Verifies console.log was called exactly once during the server startup
   * sequence — no spurious log messages should be emitted.
   */
  test('should call console.log exactly once during startup', () => {
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toBe(EXPECTED_STARTUP_MESSAGE);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * Test Suite 4: Server Shutdown
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Tests graceful server shutdown behavior via server.close().
 * Verifies callback invocation, error-free closure, and listening state changes.
 *
 * AAP §0.10.3: "Tests must account for server auto-start by closing the
 * server in afterAll hooks."
 */
describe('Server Shutdown', () => {
  let server;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    server = requireFreshServer();
    await waitForServerReady(server);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  /**
   * Verifies that server.close() invokes its callback without error and
   * transitions the server to a non-listening state.
   * The callback's err parameter should be undefined for a clean shutdown.
   */
  test('should invoke callback when server.close() is called', (done) => {
    server.close((err) => {
      expect(err).toBeUndefined();
      expect(server.listening).toBe(false);
      done();
    });
  });

  /**
   * Verifies that after close() completes, the server is no longer listening
   * and its address is null. Creates a fresh server since the previous test
   * closed the original one.
   */
  test('should no longer be listening after close', async () => {
    // Create a fresh server since the previous test closed the main one.
    // Port 3000 is free because the previous test's close() completed.
    const freshServer = requireFreshServer();
    await waitForServerReady(freshServer);

    await new Promise((resolve) => {
      freshServer.close(() => {
        expect(freshServer.listening).toBe(false);
        expect(freshServer.address()).toBeNull();
        resolve();
      });
    });
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * Test Suite 5: EADDRINUSE Error Handling
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Simulates a port conflict by pre-binding port 3000 with a temporary
 * net.createServer(), then spawning server.js as a child process which
 * attempts to bind to the same port and fails with EADDRINUSE.
 *
 * AAP §0.10.3: "Simulating port conflicts requires pre-binding port 3000
 * with a temporary net.createServer(). The test must bind the blocking server,
 * attempt to start the application server on the same port, catch the error,
 * and then clean up both servers. Use promises and event listeners."
 */
describe('EADDRINUSE Error Handling', () => {
  let blockingServer;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // Create a TCP server that occupies port 3000 to trigger EADDRINUSE
    // when server.js attempts to bind to the same address and port
    blockingServer = net.createServer();
    await new Promise((resolve) => {
      blockingServer.listen(EXPECTED_PORT, EXPECTED_HOSTNAME, resolve);
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      blockingServer.close(() => {
        // Brief delay for OS port release
        setTimeout(resolve, 150);
      });
    });
    jest.restoreAllMocks();
  });

  /**
   * Verifies that when port 3000 is already occupied, the server child process
   * crashes with EADDRINUSE error output on stderr and exits with code 1.
   *
   * Uses child_process.fork() to spawn server.js in a separate process to
   * avoid polluting the test process with unhandled errors. The child process
   * will encounter the EADDRINUSE error, print the stack trace to stderr,
   * and exit with a non-zero code.
   */
  test('should emit error with code EADDRINUSE when port is occupied', async () => {
    const child = fork(SERVER_PATH, [], { silent: true });

    // Collect stderr data as the child process outputs the uncaught exception
    const stderrChunks = [];
    child.stderr.on('data', (data) => {
      stderrChunks.push(data.toString());
    });

    // Wait for the child process to exit — it will crash due to EADDRINUSE
    // since port 3000 is already bound by blockingServer
    const exitCode = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Child process did not exit within timeout'));
      }, CHILD_PROCESS_TIMEOUT);

      child.on('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

    const errorOutput = stderrChunks.join('');

    // The stderr output should contain the EADDRINUSE error code
    expect(errorOutput).toContain('EADDRINUSE');
    // The child process should exit with code 1 (uncaught exception)
    expect(exitCode).toBe(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * Test Suite 6: Server Error Event
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Verifies that the server instance supports error event listeners and
 * confirms it is a proper http.Server instance with expected EventEmitter
 * behavior. Tests the server's integration with Node.js EventEmitter API.
 */
describe('Server Error Event', () => {
  let server;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    server = requireFreshServer();
    await waitForServerReady(server);
  });

  afterAll(async () => {
    await closeServerAndRelease(server);
    jest.restoreAllMocks();
  });

  /**
   * Verifies that error event listeners can be attached to and removed from
   * the server instance. Tests the EventEmitter API integration (on(),
   * listenerCount(), removeListener()) on the server object.
   */
  test('should accept error event listeners', () => {
    const initialErrorListenerCount = server.listenerCount('error');
    const errorHandler = jest.fn();

    // Attach an error event listener
    server.on('error', errorHandler);
    expect(server.listenerCount('error')).toBe(initialErrorListenerCount + 1);

    // Remove the error event listener and verify count returns to initial
    server.removeListener('error', errorHandler);
    expect(server.listenerCount('error')).toBe(initialErrorListenerCount);
  });

  /**
   * Verifies that the server object exported by server.js is a proper
   * instance of http.Server, confirming it was created by http.createServer().
   */
  test('should be an instance of http.Server', () => {
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(http.Server);
  });
});
