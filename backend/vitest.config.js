import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',   // needed for supertest/Express
    // globals: true,       // optional; safe to leave false since we import from 'vitest'
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
  },
})
