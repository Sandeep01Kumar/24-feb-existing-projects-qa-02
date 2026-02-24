/**
 * Jest Configuration for Hello World Node.js HTTP Server
 *
 * This configuration file sets up Jest for testing the minimal HTTP server
 * defined in server.js. It configures the Node.js test environment (not
 * browser/jsdom), targets only server.js for code coverage collection,
 * and enforces 100% coverage thresholds across all metrics — achievable
 * because server.js is a 14-line file with zero conditional branches.
 *
 * This file takes precedence over the "jest" key in package.json, providing
 * the complete and authoritative Jest configuration for the project.
 */

module.exports = {
  // Use Node.js environment for server-side testing (not jsdom/browser)
  testEnvironment: 'node',

  // Discover test files: all *.test.js files inside __tests__/ directory
  // Matches: __tests__/server.test.js, __tests__/server.lifecycle.test.js,
  //          __tests__/server.handler.test.js
  testMatch: ['**/__tests__/**/*.test.js'],

  // Collect coverage exclusively from the sole source file
  // Excludes test files, config files, and node_modules
  collectCoverageFrom: ['server.js'],

  // Enforce 100% coverage thresholds — server.js has zero branching logic,
  // so every line, statement, function, and branch executes on every request
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },

  // Enable detailed per-test reporting in console output
  verbose: true
};
