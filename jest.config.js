/**
 * Jest Configuration
 *
 * Configures the Jest test framework for the Hello World HTTP server project.
 * Uses Node.js test environment (not jsdom) since this is a server-side project.
 * Enforces 100% coverage thresholds across all metrics for server.js.
 *
 * @see https://jestjs.io/docs/configuration
 */
module.exports = {
  // Use Node.js environment for server-side testing (not browser/jsdom)
  testEnvironment: 'node',

  // Match test files in the __tests__ directory with .test.js suffix
  testMatch: ['**/__tests__/**/*.test.js'],

  // Collect coverage only from the server source file
  collectCoverageFrom: ['server.js'],

  // Enforce 100% coverage across all metrics — achievable for this 14-line server
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // Enable verbose output for clear test result reporting
  verbose: true,
};
