import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      'dragonpay-ph': path.resolve(__dirname, '../dragonpay-node/src/index.ts'),
    },
  },
});
