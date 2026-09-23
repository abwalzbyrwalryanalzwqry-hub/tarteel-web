import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

// نطاق الحلقة يُفحص في accessControl ضد قاعدة البيانات؛ هنا نتحكّم بنتيجته
// لنثبت أن التصدير يستدعيه ويحترم رفضه.
vi.mock('../accessControl', () => ({
  assertCirclePermission: vi.fn(async () => undefined),
}));

import { exportRouter } from './export';
import { assertCirclePermission } from '../accessControl';
import type { TrpcContext } from '../_core/context';

type AuthenticatedUser = NonNullable<TrpcContext['user']>;

function createAuthContext(role: string = 'teacher'): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    loginMethod: 'manus',
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {} as TrpcContext['res'],
  };
}

describe('export router', () => {
  beforeEach(() => {
    vi.mocked(assertCirclePermission).mockReset();
    vi.mocked(assertCirclePermission).mockResolvedValue(undefined as any);
  });

  describe('circle scope', () => {
    const outOfScope = () =>
      vi
        .mocked(assertCirclePermission)
        .mockRejectedValue(new TRPCError({ code: 'FORBIDDEN', message: 'هذا المورد خارج نطاق وصولك' }));

    it('يرفض تصدير تقرير الحفظ لحلقة خارج نطاق المعلّم', async () => {
      outOfScope();
      const caller = exportRouter.createCaller(createAuthContext('teacher'));
      await expect(caller.memorizationReport({ circleId: 99, format: 'excel' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(assertCirclePermission).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 99, 'reports.export');
    });

    it('يرفض تصدير تقرير الحضور لحلقة خارج النطاق', async () => {
      outOfScope();
      const caller = exportRouter.createCaller(createAuthContext('teacher'));
      await expect(
        caller.attendanceReport({ circleId: 99, startDate: '2024-01-01', endDate: '2024-01-31', format: 'pdf' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(assertCirclePermission).toHaveBeenCalledWith(expect.anything(), 99, 'reports.export');
    });

    it('يرفض تصدير قائمة الطلاب لحلقة خارج النطاق', async () => {
      outOfScope();
      const caller = exportRouter.createCaller(createAuthContext('center_manager'));
      await expect(caller.studentsReport({ circleId: 99, format: 'excel' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(assertCirclePermission).toHaveBeenCalledWith(expect.anything(), 99, 'reports.export');
    });

    it('لا يصل إلى قاعدة البيانات قبل فحص النطاق', async () => {
      outOfScope();
      const caller = exportRouter.createCaller(createAuthContext('teacher'));
      const error = await caller.memorizationReport({ circleId: 99, format: 'excel' }).catch((e) => e);
      expect(error.message).not.toBe('Database not available');
    });

    it('الطالب يُرفض بدوره قبل أي فحص نطاق', async () => {
      const caller = exportRouter.createCaller(createAuthContext('student'));
      await expect(caller.memorizationReport({ circleId: 1, format: 'excel' })).rejects.toThrow('Unauthorized');
      expect(assertCirclePermission).not.toHaveBeenCalled();
    });
  });

  describe('authorization', () => {
    it('should reject unauthorized users for memorization report', async () => {
      const ctx = createAuthContext('student');
      const caller = exportRouter.createCaller(ctx);

      try {
        await caller.memorizationReport({
          circleId: 1,
          format: 'excel',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Unauthorized');
      }
    });

    it('should allow teachers to export memorization report', async () => {
      const ctx = createAuthContext('teacher');
      const caller = exportRouter.createCaller(ctx);

      // This will fail due to missing database, but authorization should pass
      try {
        await caller.memorizationReport({
          circleId: 1,
          format: 'excel',
        });
      } catch (error: any) {
        // Expected to fail due to database not available
        expect(error.message).not.toBe('Unauthorized');
      }
    });

    it('should allow center managers to export reports', async () => {
      const ctx = createAuthContext('center_manager');
      const caller = exportRouter.createCaller(ctx);

      try {
        await caller.attendanceReport({
          circleId: 1,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'pdf',
        });
      } catch (error: any) {
        expect(error.message).not.toBe('Unauthorized');
      }
    });
  });

  describe('input validation', () => {
    it('should require circleId for memorization report', async () => {
      const ctx = createAuthContext('teacher');
      const caller = exportRouter.createCaller(ctx);

      try {
        await caller.memorizationReport({
          circleId: 0,
          format: 'excel',
        } as any);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Zod validation should catch this
        expect(error).toBeDefined();
      }
    });

    it('should accept valid format values', async () => {
      const ctx = createAuthContext('teacher');
      const caller = exportRouter.createCaller(ctx);

      const validFormats = ['excel', 'pdf'];
      for (const format of validFormats) {
        try {
          await caller.memorizationReport({
            circleId: 1,
            format: format as 'excel' | 'pdf',
          });
        } catch (error: any) {
          // Should not fail due to format validation
          expect(error.message).not.toContain('format');
        }
      }
    });
  });
});
