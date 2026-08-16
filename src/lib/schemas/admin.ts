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

export const cycleUpdateSchema = z.object({
  id: z.string().min(1).max(64),
  isActive: z.boolean().optional(),
  applicationFeeCents: z.number().int().min(0).max(10000000).optional(),
  applicationCurrency: z.enum(['USD', 'NGN', 'GHS']).optional(),
  applicationsCloseAt: z.string().datetime().optional(),
});
export type CycleUpdateInput = z.infer<typeof cycleUpdateSchema>;
