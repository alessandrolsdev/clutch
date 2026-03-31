import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().trim().email('Digite um email válido.'),
  password: z
    .string()
    .min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
});

export const registerRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'O username precisa ter no mínimo 3 caracteres.')
    .max(30, 'O username precisa ter no máximo 30 caracteres.')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'O username aceita apenas letras, números e underscore.',
    ),
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

export const registerBackendResponseSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  token: z.string().min(1),
});

export const loginSessionSchema = loginBackendResponseSchema.pick({
  id: true,
  username: true,
  message: true,
});

export const registerSessionSchema = registerBackendResponseSchema.pick({
  id: true,
  username: true,
});

export const authSessionSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email('Email inválido.'),
});

export type LoginRequestValues = z.infer<typeof loginRequestSchema>;
export type LoginSession = z.infer<typeof loginSessionSchema>;
export type RegisterRequestValues = z.infer<typeof registerRequestSchema>;
export type RegisterSession = z.infer<typeof registerSessionSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
