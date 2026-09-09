import { PrismaClient, PermissionScope } from '@prisma/client';

const prisma = new PrismaClient();

type PermissionSeed = readonly [string, string, string, string, string];

const permissions: PermissionSeed[] = [
  ['employee.read', 'Read employees', 'EMPLOYEE', 'READ', 'EMPLOYEE'],
  ['employee.manage', 'Manage employees', 'EMPLOYEE', 'MANAGE', 'EMPLOYEE'],
  ['organization.read', 'Read organization structure', 'ORGANIZATION', 'READ', 'ORGANIZATION'],
  ['organization.manage', 'Manage organization structure', 'ORGANIZATION', 'MANAGE', 'ORGANIZATION'],
  ['performance.config.read', 'Read performance configuration', 'PERFORMANCE', 'READ', 'CONFIGURATION'],
  ['performance.config.write', 'Manage performance configuration', 'PERFORMANCE', 'WRITE', 'CONFIGURATION'],
  ['performance.review.read', 'Read performance reviews', 'PERFORMANCE', 'READ', 'REVIEW'],
  ['performance.review.create', 'Create performance reviews', 'PERFORMANCE', 'CREATE', 'REVIEW'],
  ['performance.review.score.own', 'Score own review', 'PERFORMANCE', 'SCORE_OWN', 'REVIEW'],
  ['performance.review.score.direct_reports', 'Score direct report reviews', 'PERFORMANCE', 'SCORE_DIRECT_REPORTS', 'REVIEW'],
  ['performance.review.workflow', 'Perform review workflow actions', 'PERFORMANCE', 'WORKFLOW', 'REVIEW'],
  ['performance.review.finalize', 'Finalize performance reviews', 'PERFORMANCE', 'FINALIZE', 'REVIEW'],
  ['it.users.read', 'View users', 'IT_ADMIN', 'READ', 'USER'],
  ['it.users.manage', 'Manage user status', 'IT_ADMIN', 'MANAGE', 'USER'],
  ['it.sessions.manage', 'Manage sessions', 'IT_ADMIN', 'MANAGE', 'SESSION'],
  ['it.security.read', 'View authentication events', 'IT_ADMIN', 'READ', 'SECURITY'],
  ['it.audit.read', 'View audit logs', 'IT_ADMIN', 'READ', 'AUDIT'],
  ['it.system.read', 'View system health', 'IT_ADMIN', 'READ', 'SYSTEM'],
  ['it.system.manage', 'Manage system settings', 'IT_ADMIN', 'MANAGE', 'SYSTEM'],
  ['it.backups.manage', 'Manage backups', 'IT_ADMIN', 'MANAGE', 'BACKUP'],
] as const;

const rolePermissions: Record<string, Array<[string, PermissionScope]>> = {
  EMPLOYEE: [
    ['performance.review.read', PermissionScope.OWN],
    ['performance.review.create', PermissionScope.OWN],
    ['performance.review.score.own', PermissionScope.OWN],
    ['performance.review.workflow', PermissionScope.OWN],
  ],
  SUPERVISOR: [
    ['employee.read', PermissionScope.DIRECT_REPORTS],
    ['performance.review.read', PermissionScope.DIRECT_REPORTS],
    ['performance.review.score.direct_reports', PermissionScope.DIRECT_REPORTS],
    ['performance.review.workflow', PermissionScope.DIRECT_REPORTS],
  ],
  HOD: [
    ['employee.read', PermissionScope.ORG_SUBTREE],
    ['performance.review.read', PermissionScope.ORG_SUBTREE],
    ['performance.review.score.direct_reports', PermissionScope.ORG_SUBTREE],
    ['performance.review.workflow', PermissionScope.ORG_SUBTREE],
  ],
  HR_OFFICER: [
    ['employee.read', PermissionScope.ORGANIZATION],
    ['employee.manage', PermissionScope.ORGANIZATION],
    ['organization.read', PermissionScope.ORGANIZATION],
    ['performance.config.read', PermissionScope.ORGANIZATION],
    ['performance.review.read', PermissionScope.ORGANIZATION],
    ['performance.review.create', PermissionScope.ORGANIZATION],
    ['performance.review.workflow', PermissionScope.ORGANIZATION],
  ],
  PMS_ADMIN: [
    ['employee.read', PermissionScope.ORGANIZATION],
    ['organization.read', PermissionScope.ORGANIZATION],
    ['performance.config.read', PermissionScope.ORGANIZATION],
    ['performance.config.write', PermissionScope.ORGANIZATION],
    ['performance.review.read', PermissionScope.ORGANIZATION],
    ['performance.review.create', PermissionScope.ORGANIZATION],
    ['performance.review.workflow', PermissionScope.ORGANIZATION],
    ['performance.review.finalize', PermissionScope.ORGANIZATION],
  ],
  IT_ADMIN: [
    ['it.users.read', PermissionScope.ORGANIZATION],
    ['it.users.manage', PermissionScope.ORGANIZATION],
    ['it.sessions.manage', PermissionScope.ORGANIZATION],
    ['it.security.read', PermissionScope.ORGANIZATION],
    ['it.audit.read', PermissionScope.ORGANIZATION],
    ['it.system.read', PermissionScope.ORGANIZATION],
    ['it.system.manage', PermissionScope.ORGANIZATION],
    ['it.backups.manage', PermissionScope.ORGANIZATION],
  ],
  AUDITOR: [
    ['employee.read', PermissionScope.ORGANIZATION],
    ['organization.read', PermissionScope.ORGANIZATION],
    ['performance.review.read', PermissionScope.ORGANIZATION],
    ['it.audit.read', PermissionScope.ORGANIZATION],
  ],
};

async function getOrCreateRole(code: string) {
  const names: Record<string, string> = {
    EMPLOYEE: 'Employee', SUPERVISOR: 'Supervisor', HOD: 'Head of Department',
    HR_OFFICER: 'HR Officer', PMS_ADMIN: 'PMS Administrator', IT_ADMIN: 'IT System Administrator',
    AUDITOR: 'Auditor', SUPER_ADMIN: 'Super Administrator',
  };
  const descriptions: Record<string, string> = {
    EMPLOYEE: 'Standard employee performance access', SUPERVISOR: 'Supervisor access to direct reports',
    HOD: 'Head-level access to an organizational subtree', HR_OFFICER: 'Human resources administration',
    PMS_ADMIN: 'Performance management administration', IT_ADMIN: 'Technical administration without performance-business ownership',
    AUDITOR: 'Read-only audit and organizational access', SUPER_ADMIN: 'Full system administration',
  };
  const existing = await prisma.role.findFirst({ where: { organizationId: null, code } });
  if (existing) return prisma.role.update({ where: { id: existing.id }, data: { name: names[code], description: descriptions[code], systemRole: true, active: true } });
  return prisma.role.create({ data: { code, name: names[code], description: descriptions[code], systemRole: true, active: true } });
}

async function main() {
  const permissionIds = new Map<string, string>();
  for (const [code, name, module, action, resource] of permissions) {
    const permission = await prisma.permission.upsert({ where: { code }, update: { name, module, action, resource }, create: { code, name, module, action, resource } });
    permissionIds.set(code, permission.id);
  }

  for (const code of [...Object.keys(rolePermissions), 'SUPER_ADMIN']) {
    const role = await getOrCreateRole(code);
    const assignments = code === 'SUPER_ADMIN'
      ? permissions.map(([permissionCode]) => [permissionCode, PermissionScope.GLOBAL] as [string, PermissionScope])
      : rolePermissions[code];
    for (const [permissionCode, scope] of assignments) {
      const permissionId = permissionIds.get(permissionCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: { scope },
        create: { roleId: role.id, permissionId, scope },
      });
    }
  }

  console.log(`RBAC bootstrap completed: ${permissions.length} permissions, 8 system roles.`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
