import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, generateTestToken } from '../../helpers/build-app';

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    existsByEmailOrUsername: vi.fn(),
    create:                  vi.fn(),
    findByEmail:             vi.fn(),
    findByUsername:          vi.fn(),
    findById:                vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash:    vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
}));

import { userRepository } from '@/core/repositories/user.repository';
import bcrypt             from 'bcrypt';

const mockUser = {
  id:            'user-id-1',
  username:      'clutchplayer',
  email:         'player@clutch.gg',
  password_hash: 'hashed-password',
  isActive:      true,
  createdAt:     new Date(),
  updatedAt:     new Date(),
};

describe('Auth Routes', () => {

  beforeEach(() => vi.clearAllMocks());

  describe('POST /auth/register', () => {
    it('retorna 201 com token JWT', async () => {
      vi.mocked(userRepository.existsByEmailOrUsername).mockResolvedValue(false);
      vi.mocked(userRepository.create).mockResolvedValue(mockUser);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: { username: 'clutchplayer', email: 'player@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toHaveProperty('token');
      await app.close();
    });

    it('retorna 409 quando usuário já existe', async () => {
      vi.mocked(userRepository.existsByEmailOrUsername).mockResolvedValue(true);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: { username: 'clutchplayer', email: 'player@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(409);
      await app.close();
    });

    it('retorna 400 com dados inválidos', async () => {
      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: { username: 'ab', email: 'invalid', password: '123' },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('POST /auth/login', () => {
    it('retorna 200 com token JWT', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: { email: 'player@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('token');
      await app.close();
    });

    it('retorna 401 com senha incorreta', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: { email: 'player@clutch.gg', password: 'wrong' },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('retorna 401 com email inexistente', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      const app      = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: { email: 'naoexiste@clutch.gg', password: 'password123' },
      });

      expect(response.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('GET /auth/me', () => {
    it('retorna 200 com dados do usuário autenticado', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

      const app   = await buildApp();
      const token = generateTestToken(app);

      const response = await app.inject({
        method:  'GET',
        url:     '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ username: 'clutchplayer' });
      await app.close();
    });

    it('retorna 401 sem token', async () => {
      const app      = await buildApp();
      const response = await app.inject({ method: 'GET', url: '/auth/me' });

      expect(response.statusCode).toBe(401);
      await app.close();
    });
  });

});