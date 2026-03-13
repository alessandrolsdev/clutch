import { describe, it, expect } from 'vitest';
import { makeUser, makePost, makeNotification } from '../helpers/factories';

// ─────────────────────────────────────────────────────────────
// Smoke test — valida que o setup do Vitest está funcionando
// Se este teste passar, toda a configuração está correta:
// - Vitest rodando
// - Path aliases (@/) resolvendo
// - Globals (describe, it, expect) disponíveis
// - Factories funcionando
// ─────────────────────────────────────────────────────────────

describe('Vitest setup', () => {

  it('ambiente de teste está configurado corretamente', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('globals do Vitest estão disponíveis', () => {
    expect(true).toBe(true);
  });

  describe('factories', () => {

    it('makeUser gera usuário com dados padrão', () => {
      const user = makeUser();

      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toContain('@clutch.gg');
      expect(user.isActive).toBe(true);
    });

    it('makeUser aceita overrides', () => {
      const user = makeUser({ username: 'clutchplayer', email: 'clutch@clutch.gg' });

      expect(user.username).toBe('clutchplayer');
      expect(user.email).toBe('clutch@clutch.gg');
    });

    it('makeUser gera IDs únicos a cada chamada', () => {
      const user1 = makeUser();
      const user2 = makeUser();

      expect(user1.id).not.toBe(user2.id);
      expect(user1.username).not.toBe(user2.username);
    });

    it('makePost gera post com dados padrão', () => {
      const post = makePost();

      expect(post.id).toBeDefined();
      expect(post.type).toBe('TEXT');
      expect(post.createdAt).toBeInstanceOf(Date);
    });

    it('makeNotification gera notificação não lida por padrão', () => {
      const notif = makeNotification();

      expect(notif.isRead).toBe(false);
      expect(notif.type).toBe('FRIEND_REQUEST');
    });
  });
});
