// .eslintrc.cjs

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: './tsconfig.json', // Enables type-aware rules
      tsconfigRootDir: __dirname,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    env: {
      node: true,
      es2021: true,
    },
    plugins: [
      '@typescript-eslint',
      'simple-import-sort',
      'import',
      'unused-imports',
    ],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'plugin:prettier/recommended',
    ],
    rules: {
      // 🧹 Clean code
      'no-console': 'warn',
      'no-debugger': 'warn',
  
      // 💡 Remove unused
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
  
      // 🚦 TypeScript best practices
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': 'off',
  
      // 🚚 Import sorting
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      'import/order': 'off', // optional if you're using simple-import-sort
  
      // ✅ Prettier already handles formatting rules
      'prettier/prettier': [
        'warn',
        {
          semi: true,
          singleQuote: true,
          printWidth: 100,
          tabWidth: 2,
          trailingComma: 'all',
        },
      ],
    },
    ignorePatterns: ['dist/', 'node_modules/', '*.js'],
  };
  