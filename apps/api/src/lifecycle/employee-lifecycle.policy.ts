import { ForbiddenException } from '@nestjs/common';

export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'EXITED';

/**
 * Central employment-lifecycle rules. Account state and employment state remain
 * separate, while workflow eligibility is derived consistently from status.
 */
export class EmployeeLifecyclePolicy {
  static isLoginEligible(status: EmploymentStatus) {
    return status === 'ACTIVE' || status === 'ON_LEAVE';
  }

  static accountShouldBeActive(status: EmploymentStatus) {
    return this.isLoginEligible(status);
  }

  static canCreatePerformancePlan(status: EmploymentStatus) {
    return status === 'ACTIVE';
  }

  static canAssessPerformance(status: EmploymentStatus) {
    return status === 'ACTIVE';
  }

  static canBeAssignedAsAssessor(status: EmploymentStatus) {
    return status === 'ACTIVE';
  }

  static assertCanCreatePerformancePlan(status: EmploymentStatus) {
    if (!this.canCreatePerformancePlan(status)) throw new ForbiddenException('Only active employees can have new performance plans created');
  }

  static assertCanAssessPerformance(status: EmploymentStatus) {
    if (!this.canAssessPerformance(status)) throw new ForbiddenException('Only active employees can complete performance assessments');
  }
}
