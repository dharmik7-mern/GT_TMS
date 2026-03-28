import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  workspace: z.string().trim().min(2).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(200).optional(),
  companyCode: z.string().trim().min(1).max(80).optional(),
  employeeCode: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(1).max(200),
}).superRefine((value, ctx) => {
  const hasEmail = Boolean(value.email);
  const hasEmployeeCredentials = Boolean(value.companyCode && value.employeeCode);

  if (!hasEmail && !hasEmployeeCredentials) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either email or company code with employee code',
      path: ['email'],
    });
  }
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(10).optional(),
  })
  .optional()
  .transform((value) => value ?? {});

