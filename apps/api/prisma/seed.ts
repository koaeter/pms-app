import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function passwordHash(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt.toString('hex')}:${derived}`;
}

async function main() {
  const permissionCodes = ['organisation.read', 'organisation.manage', 'users.read', 'users.manage', 'roles.read', 'roles.manage'];
  const permissions = [];
  for (const code of permissionCodes) permissions.push(await prisma.permission.upsert({ where: { code }, update: {}, create: { code } }));

  const role = await prisma.role.upsert({ where: { name: 'SYSTEM_ADMIN' }, update: {}, create: { name: 'SYSTEM_ADMIN', description: 'Full system administration access' } });
  for (const permission of permissions) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });

  const username = process.env.PMS_ADMIN_USERNAME ?? 'admin';
  const password = process.env.PMS_ADMIN_PASSWORD;
  if (!password) throw new Error('PMS_ADMIN_PASSWORD must be set when seeding the administrator account.');

  const user = await prisma.user.upsert({ where: { username }, update: { isActive: true }, create: { username, passwordHash: passwordHash(password), firstName: 'System', lastName: 'Administrator' } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
}

main().finally(() => prisma.$disconnect());
