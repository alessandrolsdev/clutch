import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../helpers/build-app';

// ─────────────────────────────────────────────────────────────
// Mock do userRepository — sem banco real
// ─────────────────────────────────────────────────────────────

vi.mock('@/core/repositories/user.repository', () => ({
  userRepository: {
    existsByEmailOrUsername: vi.fn(),
    create:                  vi.fn(),
    findByEmail:             vi.fn(),
    findByUsername:          vi.fn(),
    findById:                vi.fn(),
  },
}));

import { userRepository } from '@/core/repositories/user.repository';

const mockUser = {
  id:            'user-id-1',
  username:      'clutchplayer',
  email:         'player@clutch.gg',
  password_hash: 'password123',
  isActive:      true,
  createdAt:     new Date(),
  updatedAt:     new Date(),
};

describe('Auth Routes', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /auth/register ──────────────────────────────────
  describe('POST /auth/register', () => {

    it('retorna 201 com dados válidos', async () => {
      vi.mocked(userRepository.existsByEmailOrUsername).mockResolvedValue(false);
      vi.mocked(userRepository.create).mockResolvedValue(mockUser);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: {
          username: 'clutchplayer',
          email:    'player@clutch.gg',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        id:       'user-id-1',
        username: 'clutchplayer',
      });

      await app.close();
    });

    it('retorna 409 quando email ou username já existe', async () => {
      vi.mocked(userRepository.existsByEmailOrUsername).mockResolvedValue(true);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: {
          username: 'clutchplayer',
          email:    'player@clutch.gg',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        message: 'Email ou username já está em uso.',
      });

      await app.close();
    });

    it('retorna 400 com username inválido', async () => {
      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: {
          username: 'ab',
          email:    'player@clutch.gg',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it('retorna 400 com email inválido', async () => {
      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: {
          username: 'clutchplayer',
          email:    'email-invalido',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it('retorna 400 com senha muito curta', async () => {
      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/register',
        payload: {
          username: 'clutchplayer',
          email:    'player@clutch.gg',
          password: '123',
        },
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

  });

  // ── POST /auth/login ─────────────────────────────────────
  describe('POST /auth/login', () => {

    it('retorna 200 com credenciais válidas', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: {
          email:    'player@clutch.gg',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id:       'user-id-1',
        username: 'clutchplayer',
        message:  'Acesso autorizado.',
      });

      await app.close();
    });

    it('retorna 401 com senha incorreta', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: {
          email:    'player@clutch.gg',
          password: 'senha-errada',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        message: 'Credenciais inválidas.',
      });

      await app.close();
    });

    it('retorna 401 com email inexistente', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: {
          email:    'naoexiste@clutch.gg',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        message: 'Credenciais inválidas.',
      });

      await app.close();
    });

    it('retorna 400 com body vazio', async () => {
      const app = await buildApp();
      const response = await app.inject({
        method:  'POST',
        url:     '/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      await app.close();
    });

  });

});