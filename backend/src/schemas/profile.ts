import { z } from "zod";

export const profileSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["student", "tutor", "admin"]),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(32).nullable(),
  avatar_url: z.string().trim().min(1).max(2048).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true })
});
export type Profile = z.infer<typeof profileSchema>;
