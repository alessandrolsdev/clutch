import { afterEach, describe, expect, it } from 'vitest';
import {
  hasValidDiscordPresenceIngestToken,
  isDiscordPresenceIngestConfigured,
  resolveDiscordPresenceIngestToken,
} from '@/config/discord-presence';

describe('discord-presence config', () => {
  const previousToken = process.env['DISCORD_PRESENCE_INGEST_TOKEN'];

  afterEach(() => {
    if (typeof previousToken === 'string') {
      process.env['DISCORD_PRESENCE_INGEST_TOKEN'] = previousToken;
      return;
    }

    delete process.env['DISCORD_PRESENCE_INGEST_TOKEN'];
  });

  it('resolve token configurado no runtime', () => {
    process.env['DISCORD_PRESENCE_INGEST_TOKEN'] = 'discord-secret';

    expect(resolveDiscordPresenceIngestToken()).toBe('discord-secret');
    expect(isDiscordPresenceIngestConfigured()).toBe(true);
  });

  it('retorna null quando token nao esta configurado', () => {
    delete process.env['DISCORD_PRESENCE_INGEST_TOKEN'];

    expect(resolveDiscordPresenceIngestToken()).toBeNull();
    expect(isDiscordPresenceIngestConfigured()).toBe(false);
  });

  it('valida segredo com comparacao segura', () => {
    process.env['DISCORD_PRESENCE_INGEST_TOKEN'] = 'discord-secret';

    expect(hasValidDiscordPresenceIngestToken('discord-secret')).toBe(true);
    expect(hasValidDiscordPresenceIngestToken('wrong-secret')).toBe(false);
    expect(hasValidDiscordPresenceIngestToken(undefined)).toBe(false);
  });
});
