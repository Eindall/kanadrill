module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Définit l'environnement des tests d'intégration avant l'import de AppModule (voir le fichier).
  setupFiles: ['<rootDir>/jest.setup-env.ts'],
  // Les tests d'intégration partagent une même base (TRUNCATE, migrations) : pas de suites en parallèle.
  maxWorkers: 1,
  coverageDirectory: '../../coverage/apps/api'
};
