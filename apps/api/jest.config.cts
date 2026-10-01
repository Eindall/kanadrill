module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Les tests d'intégration partagent une même base (TRUNCATE, migrations) : pas de suites en parallèle.
  maxWorkers: 1,
  coverageDirectory: '../../coverage/apps/api'
};
