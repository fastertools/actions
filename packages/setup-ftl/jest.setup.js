// Global test setup for all tests

// Mock global fetch if not available in Node.js
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock AbortSignal for tests
if (!global.AbortSignal) {
  global.AbortSignal = {
    timeout: jest.fn(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      aborted: false
    }))
  };
}

// Suppress console output in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Ensure process.env is properly isolated between tests
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnv };
});