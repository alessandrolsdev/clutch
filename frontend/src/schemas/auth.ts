import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().trim().email('Digite um email válido.'),
  password: z
    .string()
    .min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
});

export const loginBackendResponseSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  token: z.string().min(1),
  message: z.string().min(1),
});

export const loginSessionSchema = loginBackendResponseSchema.pick({
  id: true,
  username: true,
  message: true,
});

export type LoginRequestValues = z.infer<typeof loginRequestSchema>;
export type LoginSession = z.infer<typeof loginSessionSchema>;
