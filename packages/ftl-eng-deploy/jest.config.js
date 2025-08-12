/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@fastertools/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@fastertools/shared$': '<rootDir>/packages/shared/src/index.ts'
  },
  testTimeout: 10000,
  verbose: true,
  // Ensure tests fail if they don't have proper isolation
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};