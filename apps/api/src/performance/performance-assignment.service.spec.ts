import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';

class AssignmentRules {
  static assertAssigned(assignedId: string | null, employeeId: string) {
    if (!assignedId) throw new ForbiddenException('No reviewer has been assigned to this performance plan');
    if (assignedId !== employeeId) throw new ForbiddenException('You are not the assigned reviewer for this performance plan');
  }
}

describe('Performance assessor assignment rules', () => {
  it('allows the assigned assessor', () => {
    assert.doesNotThrow(() => AssignmentRules.assertAssigned('employee-1', 'employee-1'));
  });

  it('rejects an unassigned plan', () => {
    assert.throws(() => AssignmentRules.assertAssigned(null, 'employee-1'), ForbiddenException);
  });

  it('rejects a different employee', () => {
    assert.throws(() => AssignmentRules.assertAssigned('employee-1', 'employee-2'), ForbiddenException);
  });
});
