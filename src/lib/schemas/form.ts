import { z } from 'zod';

export const draftFileSchema = z.object({
  token: z.string().min(1),
  fileType: z.enum(['headshot', 'video']),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});
export type DraftFileInput = z.infer<typeof draftFileSchema>;

export const draftRecordSchema = z.object({
  token: z.string().min(1),
  fileType: z.enum(['headshot', 'video']),
  r2Key: z.string().min(1),
});
export type DraftRecordInput = z.infer<typeof draftRecordSchema>;

export const submitSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1).max(120),
  phone: z.string().min(5).max(40),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  countryOfResidence: z.string().min(1).max(80),
  currentCity: z.string().min(1).max(80),
  countryOfHeritage: z.string().min(1).max(80),
  bio: z.string().min(50).max(1500),
  socials: z.object({
    instagram: z.string().max(80).optional(),
    tiktok: z.string().max(80).optional(),
    twitter: z.string().max(80).optional(),
    linkedin: z.string().max(200).optional(),
  }).optional(),
});
export type SubmitInput = z.infer<typeof submitSchema>;

export const recoverSchema = z.object({
  email: z.string().email().max(254),
  reference: z.string().regex(/^MDGH-[A-Z0-9-]+$/),
  honeypot: z.string().max(0),
});
export type RecoverInput = z.infer<typeof recoverSchema>;

export const FILE_LIMITS = {
  headshot: { maxBytes: 10 * 1024 * 1024, contentTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  video:    { maxBytes: 300 * 1024 * 1024, contentTypes: ['video/mp4', 'video/quicktime', 'video/webm'] },
} as const;
