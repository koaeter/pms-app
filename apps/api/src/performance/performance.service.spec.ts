import { ConflictException, NotFoundException } from '@nestjs/common';
import { PerformanceReviewStatus } from '@prisma/client';
import { PerformanceService } from './performance.service';

describe('PerformanceService', () => {
  const prisma = {
    performanceReview: { findFirst: jest.fn() },
    performanceKpi: { findFirst: jest.fn(), update: jest.fn() },
    performanceCompetency: { findFirst: jest.fn(), update: jest.fn() },
    ratingScale: { findFirst: jest.fn() },
    performanceScore: { create: jest.fn() },
  };
  let service: PerformanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PerformanceService(prisma as never);
  });

  function mockReview(overrides: Record<string, unknown> = {}) {
    prisma.performanceReview.findFirst
      .mockResolvedValueOnce({ id: 'review-1', employee: { organizationId: 'org-1' }, status: 'IN_PROGRESS' })
      .mockResolvedValueOnce({
        id: 'review-1',
        status: 'IN_PROGRESS',
        kpis: [{ weight: 60, employeeScore: 80, supervisorScore: 90 }],
        competencies: [{ weight: 40, employeeRating: 70, supervisorRating: 80 }],
        ...overrides,
      });
  }

  describe('score lifecycle', () => {
    it('allows employee scoring while the review is being prepared or returned', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.IN_PROGRESS });
      prisma.performanceKpi.findFirst.mockResolvedValue({ id: 'pk-1', performanceReviewId: 'review-1' });
      prisma.performanceKpi.update.mockResolvedValue({ id: 'pk-1', employeeScore: 85 });

      await service.scoreKpi('org-1', 'review-1', 'kpi-1', { score: 85 }, 'employee');

      expect(prisma.performanceKpi.update).toHaveBeenCalled();
    });

    it('rejects employee scoring after submission', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.SUBMITTED });

      await expect(service.scoreKpi('org-1', 'review-1', 'kpi-1', { score: 85 }, 'employee')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceKpi.findFirst).not.toHaveBeenCalled();
      expect(prisma.performanceKpi.update).not.toHaveBeenCalled();
    });

    it('allows supervisor scoring only after employee submission', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.SUBMITTED });
      prisma.performanceKpi.findFirst.mockResolvedValue({ id: 'pk-1', performanceReviewId: 'review-1' });
      prisma.performanceKpi.update.mockResolvedValue({ id: 'pk-1', supervisorScore: 90 });

      await service.scoreKpi('org-1', 'review-1', 'kpi-1', { score: 90 }, 'supervisor');

      expect(prisma.performanceKpi.update).toHaveBeenCalled();
    });

    it('rejects supervisor scoring before employee submission', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.IN_PROGRESS });

      await expect(service.scoreKpi('org-1', 'review-1', 'kpi-1', { score: 90 }, 'supervisor')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceKpi.findFirst).not.toHaveBeenCalled();
      expect(prisma.performanceKpi.update).not.toHaveBeenCalled();
    });

    it('rejects competency rating after finalization', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.FINALIZED });

      await expect(service.rateCompetency('org-1', 'review-1', 'competency-1', { rating: 5 }, 'employee')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceCompetency.findFirst).not.toHaveBeenCalled();
      expect(prisma.performanceCompetency.update).not.toHaveBeenCalled();
    });
  });

  describe('calculateScore', () => {
    it('calculates a weighted final score using all assessments', async () => {
      mockReview();
      prisma.performanceScore.create.mockResolvedValue({ id: 'score-1', overallScore: 86 });

      const result = await service.calculateScore('org-1', 'review-1', {});

      expect(prisma.performanceScore.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          performanceReviewId: 'review-1',
          kpiScore: 90,
          competencyScore: 80,
          overallScore: 86,
          ratingScaleId: null,
          overallRating: null,
        }),
      });
      expect(result).toEqual({ id: 'score-1', overallScore: 86 });
    });

    it('rejects a review with an incomplete KPI assessment', async () => {
      mockReview({
        kpis: [{ weight: 60, employeeScore: null, supervisorScore: null }],
      });

      await expect(service.calculateScore('org-1', 'review-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceScore.create).not.toHaveBeenCalled();
    });

    it('rejects a review with an incomplete competency assessment', async () => {
      mockReview({
        competencies: [{ weight: 40, employeeRating: null, supervisorRating: null }],
      });

      await expect(service.calculateScore('org-1', 'review-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceScore.create).not.toHaveBeenCalled();
    });

    it('rejects non-positive assessment weights', async () => {
      mockReview({
        kpis: [{ weight: 0, employeeScore: 80, supervisorScore: 90 }],
      });

      await expect(service.calculateScore('org-1', 'review-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceScore.create).not.toHaveBeenCalled();
    });

    it('rejects finalized reviews', async () => {
      prisma.performanceReview.findFirst
        .mockResolvedValueOnce({ id: 'review-1', employee: { organizationId: 'org-1' }, status: PerformanceReviewStatus.FINALIZED })
        .mockResolvedValueOnce({
          id: 'review-1',
          status: PerformanceReviewStatus.FINALIZED,
          kpis: [{ weight: 60, employeeScore: 80, supervisorScore: 90 }],
          competencies: [{ weight: 40, employeeRating: 70, supervisorRating: 80 }],
        });

      await expect(service.calculateScore('org-1', 'review-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceScore.create).not.toHaveBeenCalled();
    });

    it('rejects a review with no assessments', async () => {
      mockReview({ kpis: [], competencies: [] });

      await expect(service.calculateScore('org-1', 'review-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.performanceScore.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown review', async () => {
      prisma.performanceReview.findFirst.mockResolvedValue(null);

      await expect(service.calculateScore('org-1', 'missing-review', {})).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.performanceScore.create).not.toHaveBeenCalled();
    });

    it('resolves a rating scale from the calculated overall score', async () => {
      mockReview();
      prisma.ratingScale.findFirst.mockResolvedValue({
        id: 'scale-1',
        items: [
          { label: 'Outstanding', minScore: 85, maxScore: 100 },
          { label: 'Meets expectations', minScore: 60, maxScore: 84 },
        ],
      });
      prisma.performanceScore.create.mockResolvedValue({ id: 'score-1', overallRating: 'Outstanding' });

      await service.calculateScore('org-1', 'review-1', { ratingScaleId: 'scale-1' });

      expect(prisma.performanceScore.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ overallScore: 86, overallRating: 'Outstanding', ratingScaleId: 'scale-1' }),
      });
    });
  });
});
