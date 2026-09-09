import { PrismaClient, PermissionScope } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  ['it.users.read', 'View users', 'IT_ADMIN', 'READ', 'USER'],
  ['it.users.manage', 'Manage user status', 'IT_ADMIN', 'MANAGE', 'USER'],
  ['it.sessions.manage', 'Manage sessions', 'IT_ADMIN', 'MANAGE', 'SESSION'],
  ['it.security.read', 'View authentication events', 'IT_ADMIN', 'READ', 'SECURITY'],
  ['it.audit.read', 'View audit logs', 'IT_ADMIN', 'READ', 'AUDIT'],
  ['it.system.read', 'View system health', 'IT_ADMIN', 'READ', 'SYSTEM'],
  ['it.system.manage', 'Manage system settings', 'IT_ADMIN', 'MANAGE', 'SYSTEM'],
  ['it.backups.manage', 'Manage backups', 'IT_ADMIN', 'MANAGE', 'BACKUP'],
] as const;

const roles = [
  ['IT_ADMIN', 'IT System Administrator', 'Technical administration without performance-business ownership'],
  ['SUPER_ADMIN', 'Super Administrator', 'Full system administration'],
] as const;

async function main() {
  for (const [code, name, module, action, resource] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: { name, module, action, resource },
      create: { code, name, module, action, resource },
    });
  }

  const permissionRows = await prisma.permission.findMany({ where: { code: { in: permissions.map(([code]) => code) } } });

  for (const [code, name, description] of roles) {
    let role = await prisma.role.findFirst({ where: { organizationId: null, code } });
    if (!role) {
      role = await prisma.role.create({ data: { code, name, description, systemRole: true, active: true } });
    } else {
      role = await prisma.role.update({ where: { id: role.id }, data: { name, description, systemRole: true, active: true } });
    }

    for (const permission of permissionRows) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { scope: PermissionScope.GLOBAL },
        create: { roleId: role.id, permissionId: permission.id, scope: PermissionScope.GLOBAL },
      });
    }
  }

  console.log('RBAC bootstrap completed. Assign IT_ADMIN or SUPER_ADMIN to an existing user through your administrative workflow.');
}

main().finally(() => prisma.$disconnect());
