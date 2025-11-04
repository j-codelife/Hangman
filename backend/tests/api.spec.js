import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from './helpers/http.js';

import { app, resetGames, gamesStore } from '../server.js';

const token = Buffer.from('tester').toString('base64');
const client = createClient(app);
const auth = { authorization: `Bearer ${token}` };

beforeEach(() => {
  resetGames();
});

describe('Hangman API', () => {
  it('reports healthy status', async () => {
    const res = await client.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it('rejects unauthorized calls to protected routes', async () => {
    const res = await client.post('/api/games');
    expect(res.status).toBe(401);
  });

  it('creates a new game for authenticated users', async () => {
    const res = await client.post('/api/games', { headers: auth });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('gameId');
    expect(res.body).toHaveProperty('masked');
    expect(Array.isArray(res.body.wrong)).toBe(true);
    expect(res.body.status).toBe('playing');
  });

  it('accepts a correct letter guess and keeps lives intact', async () => {
    const createRes = await client.post('/api/games', { headers: auth });
    const { gameId } = createRes.body;
    const stored = gamesStore.get(gameId);
    expect(stored).toBeTruthy();
    const letter = stored.word[0];

    const guessRes = await client.post(`/api/games/${gameId}/guess`, {
      headers: auth,
      body: { guess: letter },
    });

    expect(guessRes.status).toBe(200);
    expect(guessRes.body.lives).toBe(createRes.body.lives);
    const normalizedMasked = (guessRes.body.masked || '').replace(/\s+/g, '');
    expect(normalizedMasked.includes(letter)).toBe(true);
  });

  it('penalizes a wrong full-word guess', async () => {
    const createRes = await client.post('/api/games', { headers: auth });
    const { gameId } = createRes.body;

    const wrongWord = 'zzzz';
    const guessRes = await client.post(`/api/games/${gameId}/guess`, {
      headers: auth,
      body: { guess: wrongWord },
    });

    expect(guessRes.status).toBe(200);
    expect(guessRes.body.lives).toBe(createRes.body.lives - 1);
    expect(guessRes.body.status).toBe('playing');
  });
});
