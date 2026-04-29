/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload, VerifiedJwtPayload } from '../config/jwt';
import type { DiscordOAuthService } from '../core/services/discord-oauth.service';
import type { DiscordPresenceService } from '../core/services/discord-presence.service';
import type { IntegrationsService } from '../core/services/integrations.service';
import type { RefreshTokenService } from '../core/services/refresh-token.service';
import type { AccountConnectionService } from '../core/services/account-connection.service';
import type { SocialAuthService } from '../core/services/social-auth.service';

// ─────────────────────────────────────────────────────────────
// Type augmentation — adiciona authenticate ao FastifyInstance
// e userId/username ao FastifyRequest
// ─────────────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    signAccessToken(payload: JwtPayload): string;
    verifyAccessToken(token: string): VerifiedJwtPayload;
    refreshTokenService: RefreshTokenService;
    integrationsService: IntegrationsService;
    discordOAuthService: DiscordOAuthService;
    discordPresenceService: DiscordPresenceService;
    socialAuthService: SocialAuthService;
    accountConnectionService: AccountConnectionService;
  }

  interface FastifyRequest {
    userId:   string;
    username: string;
  }
}
