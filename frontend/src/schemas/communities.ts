import { z } from 'zod';

export const communityRoleSchema = z.enum(['OWNER', 'MEMBER']);
export const communityVisibilitySchema = z.enum(['PUBLIC']);
export const communityStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export const communityEventStatusSchema = z.enum(['PUBLISHED', 'CANCELLED']);
export const communityEventRsvpStatusSchema = z.enum(['GOING', 'INTERESTED', 'NOT_GOING']);

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

export const communityEventCreatorSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
});

export const communityEventSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startsAt: z.string(),
  status: communityEventStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: communityEventCreatorSchema,
  viewerRsvp: communityEventRsvpStatusSchema.nullable(),
  rsvpCounts: z.object({
    going: z.number().int().nonnegative(),
    interested: z.number().int().nonnegative(),
    notGoing: z.number().int().nonnegative(),
  }),
});

export const communityEventsResponseSchema = z.object({
  events: z.array(communityEventSchema),
});

export const communityEventResponseSchema = z.object({
  event: communityEventSchema,
});

export const createCommunityRequestSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(240).optional(),
});

export const createCommunityEventRequestSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(280).optional(),
  startsAt: z.string().datetime(),
});

export type CommunityRole = z.infer<typeof communityRoleSchema>;
export type CommunityEventRsvpStatus = z.infer<typeof communityEventRsvpStatusSchema>;
export type Community = z.infer<typeof communitySchema>;
export type CommunityEvent = z.infer<typeof communityEventSchema>;
export type CommunitiesResponse = z.infer<typeof communitiesResponseSchema>;
export type CommunityResponse = z.infer<typeof communityResponseSchema>;
export type CommunityEventsResponse = z.infer<typeof communityEventsResponseSchema>;
export type CommunityEventResponse = z.infer<typeof communityEventResponseSchema>;
export type CreateCommunityValues = z.infer<typeof createCommunityRequestSchema>;
export type CreateCommunityEventValues = z.infer<typeof createCommunityEventRequestSchema>;
