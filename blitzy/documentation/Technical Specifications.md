# Technical Specification

# 0. Agent Action Plan

## 0.1 Intent Clarification

### 0.1.1 Core Testing Objective

Based on the provided requirements, the Blitzy platform understands that the testing objective is to **create a comprehensive unit test suite from scratch** for `server.js`—a minimal, zero-dependency Node.js HTTP server that uses the built-in `http` module to serve a deterministic plain-text response.

**Request Category:** Add new tests (greenfield — no tests exist today)

The user's requirements, restated with enhanced clarity:

- **HTTP Responses:** Verify that every incoming HTTP request receives the correct response body (`Hello, World!\n`), regardless of request method, path, or headers
- **Status Codes:** Assert that the server always responds with HTTP status code `200`
- **Headers:** Confirm the `Content-Type` response header is set to `text/plain` and no unexpected headers are present
- **Server Startup/Shutdown:** Test that the server binds to `127.0.0.1:3000`, emits the expected startup log message to stdout, and shuts down gracefully without errors
- **Error Handling:** Exercise error scenarios including port-already-in-use conflicts (`EADDRINUSE`), connection handling, and request/response stream error propagation
- **Edge Cases:** Cover boundary conditions such as concurrent requests, large payloads in requests, malformed HTTP requests, various HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD), and requests to arbitrary paths

**Implicit testing needs surfaced by analysis:**
- The server has a universal request handler that ignores the `req` object entirely — every path, method, and header combination produces an identical response. This uniformity is itself a testable property
- The response body is exactly 15 bytes (`Hello, World!\n`), enabling `Content-Length` verification
- The server performs no error handling of its own — all error behavior is inherited from Node.js `http` module defaults
- The server starts listening immediately on `require()`, which requires a specific test harness strategy (child process spawning or module-level lifecycle hooks)

### 0.1.2 Special Instructions and Constraints

**Testing Framework:** The user specifies "Jest or Mocha." Based on analysis, **Jest 29.7.0** is recommended as the primary framework because:
- It provides built-in assertions, mocking, and coverage with zero additional packages
- It is the most widely adopted Node.js testing framework
- It fully supports Node.js 20.x
- It minimizes the number of `devDependencies` to install

**Constraints to navigate:**
- The tech spec (Section 6.6) formally designates testing as "Not Applicable" under five architectural constraints (C-001 through C-005), with C-002 specifically prohibiting external npm dependencies. The user's explicit request to add Jest/Mocha tests overrides this formal designation for testing purposes only
- The `server.js` file auto-starts the server on `require()` — it does not export the server object or the request handler. Tests must account for this by either modifying the module to add an export, or by spawning the server as a child process
- `package.json` declares `"main": "index.js"` but the actual entry point is `server.js` — this mismatch is a known anomaly but does not affect test execution

**Web search requirements fulfilled:**
- Jest 29.7.0 compatibility with Node.js 20 — confirmed (supports Node 14.15, 16.10, 18.0+)
- Supertest 7.2.2 as HTTP testing utility — confirmed compatible with raw `http.Server` instances
- Mocha 11.7.5 compatibility — confirmed (supports ^18.18.0 || ^20.9.0 || >=21.1.0), available as alternative

### 0.1.3 Technical Interpretation

These testing requirements translate to the following technical test implementation strategy:

- To **test HTTP responses**, we will create `__tests__/server.test.js` with test cases that make HTTP requests to the running server and assert the response body matches `Hello, World!\n`
- To **test status codes**, we will add assertions in each request test verifying `res.statusCode === 200` across all HTTP methods
- To **test headers**, we will assert `Content-Type: text/plain` is present and verify the `Content-Length` header for the 15-byte response body
- To **test server startup**, we will spawn `server.js` as a child process, capture stdout, and verify the startup log message `Server running at http://127.0.0.1:3000/`
- To **test server shutdown**, we will programmatically close the server instance and verify no errors are thrown, all connections are terminated, and the process exits cleanly
- To **test error handling**, we will simulate port conflicts by pre-binding to port 3000 before starting the server, and verify the resulting `EADDRINUSE` error behavior
- To **test edge cases**, we will send requests with various HTTP methods, arbitrary URL paths, large request bodies, and concurrent requests to verify uniform server behavior

### 0.1.4 Coverage Requirements Interpretation

**Explicit coverage targets:** The user did not specify a numeric coverage target.

**Implicit coverage expectations based on analysis:**
- Given that `server.js` is a single 14-line file with zero branching logic, **100% line coverage and 100% statement coverage** is achievable and expected
- The only branch-like behavior is the callback structure — all code paths execute on every request
- Industry standard for Node.js projects is ≥80% coverage; for a file this small, 100% is the practical target

To achieve comprehensive testing, coverage should include:
- All 5 testable contracts from the tech spec (TC-001 through TC-005): status code 200, Content-Type text/plain, body "Hello, World!\n", server binding to 127.0.0.1:3000, and startup log message
- The `http.createServer` callback (request handler)
- The `server.listen` callback (startup handler)
- Error event propagation from the `server` object

## 0.2 Test Discovery and Analysis

### 0.2.1 Existing Test Infrastructure Assessment

Repository analysis was conducted by inspecting all four files in the project root (`server.js`, `package.json`, `package-lock.json`, `README.md`) and searching for any test-related artifacts.

**Repository analysis reveals zero testing infrastructure:**

- **No test files exist** — no files matching `*test*`, `*spec*`, `test_*`, `spec_*`, `*_test.*`, or `*_spec.*` patterns found anywhere in the repository
- **No test directories** — no `__tests__/`, `test/`, `tests/`, `spec/`, or similar directories exist
- **No testing framework installed** — `package.json` has zero `dependencies` and zero `devDependencies`; `package-lock.json` confirms zero external packages
- **No test configuration files** — no `jest.config.js`, `jest.config.ts`, `.babelrc`, `pytest.ini`, `.mocharc.yml`, `.mocharc.js`, or any other test configuration files detected
- **No coverage configuration** — no `.coveragerc`, `.nycrc`, `nyc.config.js`, or `jest --coverage` configuration
- **No CI/CD configuration** — no `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, or similar automation files
- **Placeholder test script only** — `package.json` defines `"test": "echo \"Error: no test specified\" && exit 1"` which is the default `npm init` placeholder

**Detected infrastructure summary:**

| Component | Status | Details |
|-----------|--------|---------|
| Testing framework | Not installed | No Jest, Mocha, or any test runner present |
| Test runner configuration | Not present | No config files for any framework |
| Coverage tools | Not installed | No nyc, c8, or Jest coverage config |
| Mock/stub libraries | Not installed | No sinon, jest-mock-extended, or similar |
| Test data fixtures | Not present | No fixture files or factory patterns |
| Assertion libraries | Not installed | No chai, expect, or similar (Jest includes its own) |
| Test utilities | Not present | No helper files or shared test utilities |

### 0.2.2 Source Code Testability Assessment

The sole source file `server.js` (path: `server.js`) was analyzed for testability:

**Current module structure:**
```javascript
const server = http.createServer((req, res) => { ... });
server.listen(port, hostname, () => { ... });
```

**Testability challenges identified:**
- **No module export:** The file does not export `server`, the request handler, or any constants. This means `require('./server')` executes the file (starting the server) but returns an empty object
- **Immediate side effects:** `server.listen()` is called at module load time — there is no way to import the module without starting the server
- **Hardcoded configuration:** `hostname` and `port` are `const` declarations with no external configuration mechanism

**Recommended testability enhancement:** Add a single line `module.exports = server;` at the end of `server.js` to allow test files to access the server instance for programmatic startup, shutdown, and request handler testing. This is the minimal change required for comprehensive testability.

**Alternative approach (no source modification):** Spawn `server.js` as a child process using Node.js `child_process.fork()` or `child_process.spawn()`, then test via HTTP requests to `http://127.0.0.1:3000`. This approach tests the server exactly as deployed but limits the ability to test individual components in isolation.

### 0.2.3 Web Search Research Conducted

The following research was conducted via web search to inform the testing strategy:

- **Jest version compatibility with Node.js 20:** Jest 29.7.0 confirmed to support Node 14.15, 16.10, 18.0 and above. Jest 30.2.0 (latest) drops Node 14/16 and requires 18.x minimum — both are compatible with Node.js 20.20.0
- **Mocha version compatibility with Node.js 20:** Mocha 11.7.5 (latest stable) requires `^18.18.0 || ^20.9.0 || >=21.1.0` — fully compatible with Node.js 20.20.0
- **Supertest for HTTP server testing:** Supertest 7.2.2 (latest) is a SuperAgent-driven library for testing Node.js HTTP servers. It accepts an `http.Server` instance or function, and automatically binds to an ephemeral port — ideal for testing raw `http.createServer()` servers without port conflicts
- **Best practices for testing Node.js HTTP servers:** Jest + Supertest is the most common pairing for Node.js HTTP server testing, supporting fluent assertions on status codes, headers, and response bodies
- **Server lifecycle management in tests:** Supertest handles server binding and teardown automatically when passed a server instance, eliminating manual port management in tests

## 0.3 Testing Scope Analysis

### 0.3.1 Test Target Identification

**Primary code to be tested:**

- **Module:** HTTP Server at `server.js` — requires unit tests for all server behaviors including request handling, response generation, server lifecycle, error handling, and edge cases

**Functions and behaviors requiring test coverage:**

| Function/Behavior | Location | Test Categories Needed |
|-------------------|----------|----------------------|
| `http.createServer(callback)` | `server.js:6` | Unit: handler invocation, response correctness |
| Request handler `(req, res) => { ... }` | `server.js:6-9` | Unit: status code, headers, body |
| `res.statusCode = 200` | `server.js:7` | Unit: status code assertion |
| `res.setHeader('Content-Type', 'text/plain')` | `server.js:8` | Unit: header assertion |
| `res.end('Hello, World!\n')` | `server.js:9` | Unit: body content and length |
| `server.listen(port, hostname, callback)` | `server.js:12` | Integration: binding, callback execution |
| Startup log `console.log(...)` | `server.js:13` | Unit: stdout message verification |

**Existing test file mapping:**

| Source File | Existing Test File | Test Categories Present |
|-------------|-------------------|----------------------|
| `server.js` | None | None — all tests must be created from scratch |

### 0.3.2 Dependencies Requiring Mocking

Given the zero-dependency architecture, mocking requirements are limited to Node.js built-ins:

- **`console.log`** — Must be mocked/spied to verify startup log message output without polluting test output
- **Port binding** — Must be managed to prevent `EADDRINUSE` conflicts between test runs; Supertest handles this by binding to ephemeral ports
- **`process.stdout`** — Alternative spy target for verifying console output
- **`http` module** — For isolated unit tests of the request handler, the `req` and `res` objects can be mocked to test the handler function in complete isolation

### 0.3.3 Version Compatibility Research

Based on the runtime environment (Node.js v20.20.0, npm 11.1.0) and web search results, the recommended testing stack is:

| Tool | Recommended Version | Compatibility Rationale |
|------|-------------------|----------------------|
| Jest | 29.7.0 | Most battle-tested v29 release; supports Node 14.15, 16.10, 18.0+; Node 20 fully supported; built-in assertions, mocking, and coverage |
| Supertest | 7.2.2 | Latest stable; works with raw `http.Server` instances; handles ephemeral port binding; no Express dependency required |

**Alternative stack (if Mocha preferred):**

| Tool | Version | Rationale |
|------|---------|-----------|
| Mocha | 11.7.5 | Latest stable; supports `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` |
| Chai | 4.5.0 | Assertion library (Mocha has no built-in assertions) |
| Sinon | 19.0.2 | Mocking/stubbing library for console.log spying |
| Supertest | 7.2.2 | Same HTTP testing utility |
| nyc | 17.1.0 | Coverage tool (Mocha has no built-in coverage) |

**Version conflict assessment:** No conflicts detected. Jest 29.7.0 and Supertest 7.2.2 have no overlapping or conflicting transitive dependencies. The `jest` package includes its own test runner, assertion library (`expect`), mocking utilities (`jest.fn()`, `jest.spyOn()`), and coverage reporting (`--coverage` flag using `istanbul` under the hood) — making it the most efficient single-package choice.

## 0.4 Test Implementation Design

### 0.4.1 Test Strategy Selection

The test suite will employ two complementary strategies to achieve comprehensive coverage of `server.js`:

**Strategy A — Supertest-based HTTP testing (primary):** Uses Supertest to make real HTTP requests against the server instance. This validates the full request/response cycle including status codes, headers, and body content. Supertest automatically binds the server to an ephemeral port, avoiding port conflicts.

**Strategy B — Isolated handler unit testing:** Directly invokes the request handler callback with mock `req` and `res` objects. This enables testing the handler in complete isolation without network I/O, verifying each `res` method call individually.

**Strategy C — Child process lifecycle testing:** Spawns `server.js` as a child process to test startup behavior, console output, and graceful shutdown without interfering with the test process's own server instances.

**Test types to implement:**
- **Unit tests:** Isolate the request handler callback; verify `res.statusCode`, `res.setHeader()`, and `res.end()` are called correctly using mock objects
- **Integration tests:** Use Supertest to send real HTTP requests and verify complete response behavior end-to-end
- **Edge case tests:** Test behavior with various HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD), arbitrary URL paths, large request payloads, and concurrent requests
- **Error handling tests:** Simulate `EADDRINUSE` by pre-binding port 3000, test server error event propagation, and verify graceful shutdown behavior

### 0.4.2 Test Case Blueprint

**Component: HTTP Request Handler**
```
Component: Request Handler (server.js:6-9)
Test Categories:
- Happy path: GET / returns 200, text/plain, "Hello, World!\n"
- Edge cases: POST/PUT/DELETE/PATCH/OPTIONS/HEAD all return identical response
- Edge cases: Arbitrary paths (/foo, /bar/baz, /nonexistent) return same response
- Edge cases: Requests with custom headers, query strings, and request bodies
- Edge cases: HEAD request returns headers but empty body
```

**Component: Server Lifecycle**
```
Component: Server Binding and Startup (server.js:12-14)
Test Categories:
- Happy path: Server binds to 127.0.0.1 on specified port
- Happy path: Startup callback logs correct message to stdout
- Error cases: EADDRINUSE when port is already occupied
- Error cases: Server close() terminates cleanly
- Performance boundaries: Concurrent requests handled without errors
```

**Component: Response Properties**
```
Component: HTTP Response (server.js:7-9)
Test Categories:
- Happy path: Status code is exactly 200
- Happy path: Content-Type header is exactly "text/plain"
- Happy path: Response body is exactly "Hello, World!\n" (15 bytes)
- Edge cases: Content-Length header reflects 15 bytes
- Edge cases: Response is identical across 100 sequential requests
```

### 0.4.3 Existing Test Extension Strategy

No existing tests to extend. All test files are new creations. The single source file `server.js` requires a minimal testability modification:

- **Modification:** Append `module.exports = server;` to `server.js` to export the server instance. This single-line addition enables Supertest integration and programmatic server lifecycle management in tests without altering any existing behavior
- **Justification:** Without this export, `require('./server')` returns `{}` and the server starts listening on a hardcoded port — making it impossible to use Supertest's ephemeral port binding or to programmatically call `server.close()` from tests

### 0.4.4 Test Data and Fixtures Design

**Required test data structures:**

Given the server's deterministic, single-response behavior, test data requirements are minimal:

- **Expected response body:** `'Hello, World!\n'` — hardcoded constant in test file
- **Expected status code:** `200` — hardcoded constant
- **Expected Content-Type:** `'text/plain'` — hardcoded constant
- **Expected hostname:** `'127.0.0.1'` — hardcoded constant
- **Expected port:** `3000` — hardcoded constant (used only for child process tests; Supertest uses ephemeral ports)
- **Expected startup message:** `` `Server running at http://127.0.0.1:3000/` `` — hardcoded constant

**Fixture organization:** No external fixture files needed. All test data is defined as constants at the top of the test file due to the minimal, deterministic nature of the server.

**Mock object specifications:**
- **Mock `req` object:** `{ method: 'GET', url: '/', headers: {} }` — minimal IncomingMessage-like object for isolated handler testing
- **Mock `res` object:** Object with `statusCode` property and spy functions for `setHeader()` and `end()` — created via `jest.fn()` stubs

**Test state management:** Each test suite uses Jest lifecycle hooks (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`) to manage server instances. Supertest tests create and close server instances per-suite. Child process tests spawn and kill processes per-test to ensure isolation.

## 0.5 Test File Transformation Mapping

### 0.5.1 File-by-File Test Plan

The complete test file transformation map for this project:

| Target Test File | Transformation | Source File/Reference | Purpose/Changes |
|-----------------|----------------|----------------------|-----------------|
| `__tests__/server.test.js` | CREATE | `server.js` | Comprehensive unit and integration tests for the HTTP server: response body, status codes, headers, HTTP methods, URL paths, edge cases, and concurrent request handling via Supertest |
| `__tests__/server.lifecycle.test.js` | CREATE | `server.js` | Server lifecycle tests: startup binding, console.log output verification, graceful shutdown, EADDRINUSE error handling, and server close behavior |
| `__tests__/server.handler.test.js` | CREATE | `server.js` | Isolated unit tests for the request handler callback using mock req/res objects without network I/O — tests statusCode assignment, setHeader calls, and end() invocation |
| `server.js` | UPDATE | `server.js` | Add `module.exports = server;` at end of file to enable testability — no behavioral changes |
| `package.json` | UPDATE | `package.json` | Add `devDependencies` (jest, supertest), update `scripts.test` to `jest --coverage --watchAll=false`, add `jest` configuration block |
| `jest.config.js` | CREATE | N/A | Jest configuration: test environment `node`, coverage thresholds, test match patterns, verbose output |

### 0.5.2 New Test Files Detail

**`__tests__/server.test.js`** — HTTP response and integration tests

- **Test categories:**
  - Happy path: GET request returns 200, text/plain, "Hello, World!\n"
  - HTTP methods: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD all produce identical responses (except HEAD omits body)
  - URL paths: `/`, `/foo`, `/bar/baz`, `/nonexistent`, `/?query=value` all return same response
  - Headers: Content-Type is text/plain, Content-Length is 15, Connection header present
  - Response body: Exact match to "Hello, World!\n" (15 bytes)
  - Concurrent requests: 10+ simultaneous requests all return identical responses
  - Large request body: POST with large payload still returns standard response
  - Custom request headers: Arbitrary headers in request do not affect response
- **Mock dependencies:** None — uses Supertest for real HTTP requests
- **Assertions focus:** Status code equality, header value matching, body string equality, response consistency across methods/paths

**`__tests__/server.lifecycle.test.js`** — Server startup, shutdown, and error tests

- **Test categories:**
  - Startup: Server binds successfully, listen callback fires
  - Console output: `console.log` is called with `Server running at http://127.0.0.1:3000/`
  - Shutdown: `server.close()` callback fires, no errors thrown
  - EADDRINUSE: Starting server when port 3000 is already bound produces error event
  - Server error event: Error listener receives proper error object with code property
  - Address info: `server.address()` returns correct host and port after binding
- **Mock dependencies:** `jest.spyOn(console, 'log')` for stdout capture; temporary `net.createServer()` for port conflict simulation
- **Assertions focus:** Event emission, error code matching, callback invocation, address object properties

**`__tests__/server.handler.test.js`** — Isolated request handler unit tests

- **Test categories:**
  - Handler sets `res.statusCode` to 200
  - Handler calls `res.setHeader('Content-Type', 'text/plain')` exactly once
  - Handler calls `res.end('Hello, World!\n')` exactly once
  - Handler does not read any property from `req` object
  - Handler executes synchronously (no async operations)
- **Mock dependencies:** Mock `req` object (empty object), mock `res` object with `jest.fn()` stubs for `setHeader` and `end`
- **Assertions focus:** `jest.fn()` call counts, argument values, invocation order

### 0.5.3 Test Files to Modify Detail

No existing test files to modify — this is a greenfield test implementation.

### 0.5.4 Source Files to Modify Detail

**`server.js`** — Add module export for testability
- **Change:** Append a single line at the end of the file: `module.exports = server;`
- **Rationale:** This enables `require('./server')` to return the server instance, which Supertest needs to bind to an ephemeral port and test infrastructure needs to call `server.close()` for cleanup
- **Impact:** Zero behavioral change — the server still starts on `require()` and listens on 127.0.0.1:3000; the only addition is the exported reference

**`package.json`** — Add test configuration and dependencies
- **Changes:**
  - Add `devDependencies`: `"jest": "^29.7.0"`, `"supertest": "^7.2.2"`
  - Update `scripts.test`: Change from placeholder to `"jest --coverage --watchAll=false"`
  - Add `jest` configuration key with `testEnvironment: "node"`

### 0.5.5 Test Configuration Updates

**`jest.config.js`** — New Jest configuration file
- Test environment: `node` (not `jsdom`, since this is a server-side project)
- Test match pattern: `**/__tests__/**/*.test.js`
- Coverage collection: Enabled from `server.js`
- Coverage thresholds: 100% lines, 100% statements, 100% functions, 100% branches
- Verbose output: Enabled for clear test result reporting

**`package.json`** (test script update):
- Old: `"test": "echo \"Error: no test specified\" && exit 1"`
- New: `"test": "jest --coverage --watchAll=false"`

### 0.5.6 Cross-File Test Dependencies

**Shared test constants:** All three test files reference the same expected values (response body, status code, content type, hostname, port). These are defined locally in each file since the values are simple string/number literals — no shared fixture file is warranted for this project size.

**Server instance management:** Both `__tests__/server.test.js` and `__tests__/server.lifecycle.test.js` require the server instance from `server.js`. Each test file must independently manage server lifecycle (close in `afterAll`) to prevent test pollution.

**Port conflict prevention:** Test files using Supertest do not conflict with each other because Supertest binds to ephemeral ports. Only `__tests__/server.lifecycle.test.js` tests that specifically verify port 3000 binding need to ensure no other test is simultaneously using that port — achieved by running lifecycle tests in a separate `describe` block with proper setup/teardown.

**Import dependencies across test files:**
- `__tests__/server.test.js` → imports `supertest`, requires `../server`
- `__tests__/server.lifecycle.test.js` → requires `../server`, `net` (built-in), `child_process` (built-in)
- `__tests__/server.handler.test.js` → requires `http` (built-in) only; extracts handler via `http.createServer` mock or direct reference

## 0.6 Dependency Inventory

### 0.6.1 Testing Dependencies

All testing packages required for this exercise, with exact names and verified versions:

| Registry | Package Name | Version | Purpose |
|----------|-------------|---------|---------|
| npm | jest | 29.7.0 | Testing framework with built-in assertions, mocking, and coverage reporting. Supports Node.js 14.15, 16.10, 18.0+. Most stable v29 release |
| npm | supertest | 7.2.2 | HTTP assertion library for testing Node.js servers. Accepts `http.Server` instances, binds to ephemeral ports, provides fluent API for status/header/body assertions |

**Packages explicitly NOT required (and rationale):**

| Package | Reason Not Needed |
|---------|------------------|
| `chai` | Jest includes built-in `expect()` assertions |
| `sinon` | Jest includes built-in `jest.fn()`, `jest.spyOn()`, and `jest.mock()` |
| `nyc` / `c8` | Jest includes built-in coverage via `--coverage` flag (uses Istanbul internally) |
| `mocha` | Jest is selected as the primary framework; Mocha would require additional assertion and mocking libraries |
| `@types/jest` | Project uses plain JavaScript (CommonJS), not TypeScript |
| `ts-jest` | No TypeScript in project |
| `jest-environment-jsdom` | Server-side testing only; the default `jest-environment-node` is correct |
| `nock` | No outbound HTTP requests to mock; the server only handles incoming requests |

**Node.js built-in modules used in tests (zero installation required):**

| Module | Purpose in Tests |
|--------|-----------------|
| `http` | Used by `server.js` itself; referenced for mock handler extraction in `server.handler.test.js` |
| `net` | Used in `server.lifecycle.test.js` to create temporary TCP server for EADDRINUSE simulation |
| `child_process` | Used in `server.lifecycle.test.js` to spawn `server.js` as a child process for startup/shutdown testing |

### 0.6.2 Import Updates

**New imports for test files (all new files — no existing imports to update):**

`__tests__/server.test.js`:
```javascript
const request = require('supertest');
const server = require('../server');
```

`__tests__/server.lifecycle.test.js`:
```javascript
const net = require('net');
const { fork } = require('child_process');
const path = require('path');
```

`__tests__/server.handler.test.js`:
```javascript
const http = require('http');
```

**Import transformation rules for source modification:**

- `server.js` requires no import changes
- The only source modification is adding `module.exports = server;` at the end of the file — this is an export addition, not an import change

**Package installation command:**
```
npm install --save-dev jest@29.7.0 supertest@7.2.2
```

This will update `package.json` with a `devDependencies` section and regenerate `package-lock.json` with the full transitive dependency tree.

## 0.7 Coverage and Quality Targets

### 0.7.1 Coverage Metrics

**Current coverage:** 0% — no tests exist and no coverage tooling is installed.

**Target coverage:** 100% across all metrics, based on the following rationale:
- `server.js` is a single 14-line file with zero conditional branches, zero early returns, and zero error-handling paths
- Every line of code executes on every request — there are no dead code paths or unreachable statements
- The file contains exactly 2 functions (request handler callback, listen callback) and 3 executable statements within the handler
- Achieving 100% coverage is not aspirational — it is the natural outcome of testing the server's basic behavior

**Coverage gap analysis:**

| Component | Current | Target | Gap | Focus Areas |
|-----------|---------|--------|-----|-------------|
| `server.js` (overall) | 0% | 100% | 100% | All lines, statements, functions, branches |
| Request handler (lines 6-9) | 0% | 100% | 100% | Handler callback invocation via HTTP request |
| `res.statusCode = 200` (line 7) | 0% | 100% | 100% | Status code assignment |
| `res.setHeader(...)` (line 8) | 0% | 100% | 100% | Header setting |
| `res.end(...)` (line 9) | 0% | 100% | 100% | Response body transmission |
| `server.listen(...)` (line 12) | 0% | 100% | 100% | Server binding invocation |
| Listen callback (line 13) | 0% | 100% | 100% | Console.log startup message |

**Jest coverage thresholds to enforce in configuration:**

```
coverageThreshold: {
  global: {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100
  }
}
```

### 0.7.2 Test Quality Criteria

**Assertion density expectations:**
- Minimum 2 assertions per test case (e.g., status code AND body content)
- Each of the 5 testable contracts (TC-001 through TC-005) must have at least one dedicated test with specific assertions
- Edge case tests should assert both the expected positive behavior AND the absence of unexpected behavior

**Test isolation requirements:**
- Each test file manages its own server instance lifecycle independently
- No test depends on the execution order or result of another test
- Supertest-based tests use ephemeral ports (no hardcoded port 3000 in HTTP tests)
- `console.log` spying is restored after each test via `jest.restoreAllMocks()` or `mockRestore()`
- Server instances are closed in `afterAll` hooks to prevent resource leaks

**Performance constraints for test execution:**
- Total test suite execution should complete in under 10 seconds (given the minimal server and zero external dependencies)
- Individual test cases should complete in under 2 seconds
- Startup/shutdown lifecycle tests with child processes may take slightly longer but should not exceed 5 seconds per test

**Maintainability standards:**
- Test file names clearly indicate their testing scope (`server.test.js`, `server.lifecycle.test.js`, `server.handler.test.js`)
- Each test uses descriptive `describe` and `it`/`test` names that read as specifications (e.g., `it('should return status code 200 for GET requests')`)
- Constants for expected values are defined at the top of each file for easy updates if the server behavior changes
- No magic numbers or strings in assertions — all expected values reference named constants

**Repository test pattern conventions:**
- Since no existing test patterns exist in this repository, the test suite establishes the convention: Jest + `__tests__/` directory + `*.test.js` naming
- This follows Jest's default test file discovery pattern and is the most widely adopted convention in the Node.js ecosystem

## 0.8 Scope Boundaries

### 0.8.1 Exhaustively In Scope

**New test files:**
- `__tests__/server.test.js` — HTTP response integration tests via Supertest
- `__tests__/server.lifecycle.test.js` — Server startup, shutdown, and error handling tests
- `__tests__/server.handler.test.js` — Isolated request handler unit tests with mock objects

**Test configuration files:**
- `jest.config.js` — Jest framework configuration (test environment, coverage thresholds, test patterns)
- `package.json` — Updates to `scripts.test` and addition of `devDependencies` block

**Source file modifications (minimal, for testability only):**
- `server.js` — Append `module.exports = server;` (single line, zero behavioral change)

**Test infrastructure (created implicitly by Jest):**
- `coverage/` — Generated coverage reports directory (created on `jest --coverage` execution)

**All test categories in scope:**
- Unit tests: Request handler isolation, response property assertions
- Integration tests: Full HTTP request/response cycle via Supertest
- Edge case tests: Multiple HTTP methods, arbitrary paths, concurrent requests, large payloads, HEAD method behavior
- Error handling tests: `EADDRINUSE` port conflict, server error events, graceful shutdown
- Lifecycle tests: Server startup binding, console output, server close behavior

### 0.8.2 Explicitly Out of Scope

**Source code modifications beyond testability:**
- No refactoring of `server.js` beyond the single `module.exports` line
- No addition of error handling logic to the server (the server's lack of error handling is itself a testable characteristic)
- No modification of hostname, port, response body, headers, or any other server behavior
- No addition of routing, middleware, or request parsing logic

**Unrelated project improvements:**
- No fix for the `package.json` entry point mismatch (`"main": "index.js"` vs actual `server.js`) — this is a known anomaly outside test scope
- No addition of a `start` script to `package.json` — not required for test execution
- No creation of `index.js` to resolve the entry point mismatch
- No `README.md` updates for testing documentation

**Infrastructure and tooling:**
- No CI/CD pipeline configuration (no `.github/workflows/`, `.gitlab-ci.yml`, or similar)
- No Docker containerization for test execution
- No ESLint, Prettier, or other linting/formatting configuration
- No TypeScript migration or type definitions
- No pre-commit hooks or git hooks for automated test execution

**Testing categories excluded:**
- No end-to-end tests requiring browser or external client
- No performance/load testing beyond basic concurrency verification
- No security testing (HTTPS, TLS, CORS — all formally out of scope per tech spec Section 1.3)
- No accessibility testing (not applicable to an HTTP API)
- No visual regression testing (no UI exists)

**Dependency scope limits:**
- Only `jest` and `supertest` as devDependencies — no additional libraries
- No Mocha, Chai, Sinon, nyc, or other alternative framework packages (Jest covers all needs)

## 0.9 Execution Parameters

### 0.9.1 Testing-Specific Instructions

**Test execution command (full suite with coverage):**
```
CI=true npx jest --coverage --watchAll=false --verbose
```

**Test execution command (via npm script, after package.json update):**
```
CI=true npm test
```

**Coverage measurement command:**
```
npx jest --coverage --coverageReporters=text --coverageReporters=lcov
```

**Single test file execution pattern:**
```
npx jest __tests__/server.test.js --verbose
npx jest __tests__/server.lifecycle.test.js --verbose
npx jest __tests__/server.handler.test.js --verbose
```

**Single test case execution (by name pattern):**
```
npx jest --testNamePattern="should return status code 200"
```

**Debug mode execution:**
```
node --inspect-brk node_modules/.bin/jest --runInBand __tests__/server.test.js
```

**Watch mode command (development convenience only, never in CI):**
```
npx jest --watch
```

### 0.9.2 Environment Setup Requirements for Tests

**Runtime prerequisites:**
- Node.js v20.20.0 (already installed)
- npm 11.1.0 (already installed)

**Dependency installation sequence:**
```
npm install --save-dev jest@29.7.0 supertest@7.2.2
```

**Pre-test environment variables:**
- `CI=true` — Prevents Jest from entering interactive/watch mode
- No other environment variables required (server has no configurable parameters)

**Port availability:** Tests using Supertest bind to ephemeral ports (assigned by the OS) and do not require port 3000 to be available. Only the lifecycle tests that specifically test port 3000 binding need that port to be free — these tests manage their own port lifecycle via setup/teardown hooks.

### 0.9.3 Test Execution Order and Isolation

**Jest's default behavior** runs test files in parallel (using worker processes) and test cases within a file sequentially. For this project:

- `__tests__/server.handler.test.js` — Can run in parallel with any other file (no network I/O, no port binding)
- `__tests__/server.test.js` — Can run in parallel with handler tests (Supertest uses ephemeral ports)
- `__tests__/server.lifecycle.test.js` — May conflict with other files if port 3000 is tested; use `--runInBand` if port conflicts occur

**Recommended CI execution command (if port conflicts arise):**
```
CI=true npx jest --runInBand --coverage --watchAll=false --verbose
```

The `--runInBand` flag serializes test file execution, preventing parallel test files from competing for port 3000. This adds minimal overhead given the small test suite size.

## 0.10 Special Instructions for Testing

### 0.10.1 Testing-Specific Requirements

The following directives govern the implementation of this test suite:

- **Minimal source modification principle:** The ONLY change permitted to `server.js` is appending `module.exports = server;` at the end of the file. No other line of `server.js` shall be modified, removed, or reordered. This preserves the immutability intent documented in the tech spec while enabling testability
- **DO NOT modify server behavior:** The request handler, response body, status code, headers, hostname, and port must remain exactly as they are. Tests validate existing behavior — they do not drive behavioral changes
- **Framework choice is Jest:** The user specified "Jest or Mocha." Jest 29.7.0 is the selected framework because it provides built-in assertions, mocking, and coverage in a single package, minimizing devDependency footprint. If the user later prefers Mocha, the alternative stack (Mocha 11.7.5 + Chai 4.5.0 + Sinon 19.0.2 + nyc 17.1.0) is documented in Section 0.3.3
- **Use Supertest for HTTP assertions:** All HTTP request/response tests must use Supertest's fluent API rather than raw `http.request()` calls, ensuring consistent assertion patterns and automatic ephemeral port management
- **Ensure all tests can run independently:** Each test file must be executable in isolation (`npx jest __tests__/server.test.js`) without depending on other test files. No shared mutable state across files
- **Ensure all tests can run in parallel:** Use Supertest's ephemeral port binding to avoid port conflicts. Only lifecycle tests that specifically validate port 3000 behavior may use the hardcoded port, and these must include proper setup/teardown
- **Match Jest conventions for file naming:** Use `__tests__/` directory and `*.test.js` suffix, which aligns with Jest's default `testMatch` configuration
- **Maintain backward compatibility in test utilities:** Since this is a greenfield test suite, no backward compatibility concerns exist. However, the test structure should be designed so that future test additions follow the same patterns (constants at top, descriptive test names, lifecycle hooks for cleanup)
- **Console output management:** All tests that verify `console.log` output must spy on the method and restore it after the test. Tests should not produce noisy console output during normal execution — use `jest.spyOn(console, 'log').mockImplementation(() => {})` to suppress server startup messages during test runs

### 0.10.2 Architectural Constraint Acknowledgment

The tech spec (Section 6.6) formally designates testing as "Not Applicable" under five architectural constraints:

| Constraint | Description | Resolution for Testing |
|-----------|-------------|----------------------|
| C-001 | Codebase immutable after initial commit | User's explicit test request overrides immutability for test files and the single `module.exports` addition |
| C-002 | Zero external npm dependencies | Jest and Supertest are added as `devDependencies` only — they do not affect production runtime |
| C-003 | Localhost-only binding (127.0.0.1) | Tests validate this constraint; Supertest's ephemeral binding does not conflict |
| C-004 | All configuration hardcoded | Tests verify hardcoded values; no configuration changes needed |
| C-005 | Single source file for all logic | Test files are separate from source; `server.js` remains the sole source file |

The five testable contracts documented in Section 6.6.3 (TC-001 through TC-005) serve as the foundational test requirements. The user's request for comprehensive testing extends beyond these five contracts to include edge cases, error handling, and lifecycle behavior not covered in the formal tech spec.

### 0.10.3 Critical Implementation Notes

- **Server auto-start on require:** When a test file executes `require('../server')`, the server immediately starts listening. Tests must account for this by closing the server in `afterAll` hooks. Supertest handles this gracefully, but lifecycle tests that spawn the server via `child_process` must explicitly kill the child process
- **HEAD request special behavior:** The HTTP specification dictates that HEAD responses include headers but omit the response body. The Node.js `http` module handles this automatically — `res.end('Hello, World!\n')` for a HEAD request will send headers with Content-Length but an empty body. Tests must assert this behavior correctly
- **EADDRINUSE testing caveat:** Simulating port conflicts requires pre-binding port 3000 with a temporary `net.createServer()`. The test must bind the blocking server, attempt to start the application server on the same port, catch the error, and then clean up both servers. Timing-sensitive — use promises and event listeners rather than timeouts
- **Package-lock.json regeneration:** Running `npm install --save-dev jest@29.7.0 supertest@7.2.2` will significantly expand `package-lock.json` from its current minimal state (zero dependencies) to include the full transitive dependency tree of Jest and Supertest. This is expected and unavoidable

