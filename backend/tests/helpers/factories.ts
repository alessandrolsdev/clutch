// ─────────────────────────────────────────────────────────────
// Factories de dados para testes
// Geram objetos com valores padrão que podem ser sobrescritos
// ─────────────────────────────────────────────────────────────

let counter = 0;

const unique = () => {
  counter++;
  return counter;
};

// ── User ──────────────────────────────────────────────────────

export interface UserFactory {
  id:            string;
  username:      string;
  email:         string;
  password_hash: string;
  isActive:      boolean;
  createdAt:     Date;
}

export const makeUser = (overrides: Partial<UserFactory> = {}): UserFactory => ({
  id:            `user-id-${unique()}`,
  username:      `player${unique()}`,
  email:         `player${unique()}@clutch.gg`,
  password_hash: 'password123',
  isActive:      true,
  createdAt:     new Date(),
  ...overrides,
});

// ── Profile ───────────────────────────────────────────────────

export interface ProfileFactory {
  id:          string;
  userId:      string;
  displayName: string | null;
  bio:         string | null;
  avatarUrl:   string | null;
  bannerUrl:   string | null;
}

export const makeProfile = (overrides: Partial<ProfileFactory> = {}): ProfileFactory => ({
  id:          `profile-id-${unique()}`,
  userId:      `user-id-${unique()}`,
  displayName: `Player ${unique()}`,
  bio:         null,
  avatarUrl:   null,
  bannerUrl:   null,
  ...overrides,
});

// ── Post ──────────────────────────────────────────────────────

export interface PostFactory {
  id:          string;
  userId:      string;
  contentText: string;
  type:        'TEXT' | 'IMAGE' | 'VIDEO' | 'ACHIEVEMENT' | 'GAME_SESSION';
  createdAt:   Date;
}

export const makePost = (overrides: Partial<PostFactory> = {}): PostFactory => ({
  id:          `post-id-${unique()}`,
  userId:      `user-id-${unique()}`,
  contentText: `Post de teste ${unique()}`,
  type:        'TEXT',
  createdAt:   new Date(),
  ...overrides,
});

// ── Notification ──────────────────────────────────────────────

export interface NotificationFactory {
  id:       string;
  userId:   string;
  actorId:  string | null;
  type:     string;
  payload:  object;
  isRead:   boolean;
}

export const makeNotification = (overrides: Partial<NotificationFactory> = {}): NotificationFactory => ({
  id:      `notif-id-${unique()}`,
  userId:  `user-id-${unique()}`,
  actorId: `user-id-${unique()}`,
  type:    'FRIEND_REQUEST',
  payload: { message: 'Teste de notificação' },
  isRead:  false,
  ...overrides,
});
