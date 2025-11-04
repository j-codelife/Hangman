import { describe, it, expect } from 'vitest';

import { app } from '../server.js';
import { createClient } from './helpers/http.js';

const client = createClient(app);

describe('Health endpoint', () => {
  it('reports ok via /api/health', async () => {
    const res = await client.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it('reports ok via /health', async () => {
    const res = await client.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });
});
