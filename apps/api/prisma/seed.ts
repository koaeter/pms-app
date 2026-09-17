import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function passwordHash(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt.toString('hex')}:${derived}`;
}

async function main() {
  const permissionCodes = [
    'organisation.read', 'organisation.manage',
    'users.read', 'users.manage',
    'roles.read', 'roles.manage',
    'performance.read', 'performance.manage', 'performance.assess', 'performance.approve',
    'reports.read', 'audit.read',
  ];
  const permissions = [];
  for (const code of permissionCodes) permissions.push(await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }));

  const roles = [
    { name: 'SYSTEM_ADMIN', description: 'Full system administration access', permissions: permissionCodes },
    { name: 'PERFORMANCE_ADMIN', description: 'Performance management administration and approval', permissions: ['organisation.read', 'performance.read', 'performance.manage', 'performance.assess', 'performance.approve', 'reports.read'] },
    { name: 'HR_ADMIN', description: 'Human resources and performance administration', permissions: ['organisation.read', 'organisation.manage', 'users.read', 'users.manage', 'performance.read', 'performance.manage', 'performance.assess', 'performance.approve', 'reports.read'] },
    { name: 'PERFORMANCE_REVIEWER', description: 'Assigned performance reviewer/final assessor access', permissions: ['organisation.read', 'performance.read', 'performance.assess'] },
    { name: 'SUPERVISOR', description: 'Supervisor assessment access', permissions: ['organisation.read', 'performance.read', 'performance.assess'] },
    { name: 'EMPLOYEE', description: 'Employee self-assessment access', permissions: ['organisation.read', 'performance.read', 'performance.assess'] },
  ];

  for (const definition of roles) {
    const role = await prisma.role.upsert({ where: { name: definition.name }, update: { description: definition.description }, create: { name: definition.name, description: definition.description } });
    for (const code of definition.permissions) {
      const permission = permissions.find((item) => item.code === code)!;
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
    }
  }

  const username = process.env.PMS_ADMIN_USERNAME ?? 'admin';
  const password = process.env.PMS_ADMIN_PASSWORD;
  if (!password) throw new Error('PMS_ADMIN_PASSWORD must be set when seeding the administrator account.');
  const systemAdmin = await prisma.role.findUniqueOrThrow({ where: { name: 'SYSTEM_ADMIN' } });
  const user = await prisma.user.upsert({ where: { username }, update: { isActive: true }, create: { username, passwordHash: passwordHash(password), firstName: 'System', lastName: 'Administrator' } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: systemAdmin.id } }, update: {}, create: { userId: user.id, roleId: systemAdmin.id } });
}

main().finally(() => prisma.$disconnect());
