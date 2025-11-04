import { describe, it, expect } from 'vitest';

import { app } from '../server.js';
import { createClient } from './helpers/http.js';

const client = createClient(app);

describe('Authentication API', () => {
  it('issues a token when username is provided', async () => {
    const res = await client.post('/api/login', {
      body: { username: 'alice' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toMatchObject({ username: 'alice' });
    const decoded = Buffer.from(res.body.token, 'base64').toString('utf8');
    expect(decoded).toBe('alice');
  });

  it('rejects missing username', async () => {
    const res = await client.post('/api/login', {
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'username required' });
  });
});
