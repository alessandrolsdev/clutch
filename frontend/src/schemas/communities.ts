import { z } from 'zod';

export const communityRoleSchema = z.enum(['OWNER', 'MEMBER']);
export const communityVisibilitySchema = z.enum(['PUBLIC']);
export const communityStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export const communityOwnerSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const communitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: communityVisibilitySchema,
  status: communityStatusSchema,
  owner: communityOwnerSchema,
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  viewerMembershipRole: communityRoleSchema.nullable().optional(),
});

export const communitiesResponseSchema = z.object({
  communities: z.array(communitySchema),
});

export const communityResponseSchema = z.object({
  community: communitySchema,
});

export const createCommunityRequestSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(240).optional(),
});

export type CommunityRole = z.infer<typeof communityRoleSchema>;
export type Community = z.infer<typeof communitySchema>;
export type CommunitiesResponse = z.infer<typeof communitiesResponseSchema>;
export type CommunityResponse = z.infer<typeof communityResponseSchema>;
export type CreateCommunityValues = z.infer<typeof createCommunityRequestSchema>;
