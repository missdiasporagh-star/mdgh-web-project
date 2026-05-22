import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminStatusUpdateSchema = z.object({
  status: z.enum(['new', 'reviewing', 'shortlisted', 'rejected']),
  adminNotes: z.string().max(2000).nullable().optional(),
});
export type AdminStatusUpdateInput = z.infer<typeof adminStatusUpdateSchema>;
