module.exports = {
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 80,
  reporter: [
    'text',
    'text-summary',
    'html'
  ],
  cache: true,
  all: true,
  include: [
    'lib/**/*.js'
  ],
  exclude: [
    'coverage/**',
    'dist/**',
    'test/**',
    'node_modules/**'
  ],
  'check-coverage': true,
  'report-dir': './coverage'
};
