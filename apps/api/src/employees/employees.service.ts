import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.employee.findMany({
      where: { organizationId, active: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: { designation: true, assignments: { where: { endDate: null, isPrimary: true }, include: { organizationalUnit: true } } },
    });
  }

  async get(organizationId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId },
      include: { designation: true, assignments: { include: { organizationalUnit: true, designation: true, supervisor: true } }, reportsTo: true, directReports: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(organizationId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        organizationId,
        employeeNumber: dto.employeeNumber.trim(),
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim() || null,
        lastName: dto.lastName.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        designationId: dto.designationId || null,
      },
      include: { designation: true },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    await this.get(organizationId, id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        middleName: dto.middleName === undefined ? undefined : dto.middleName.trim() || null,
        lastName: dto.lastName?.trim(),
        email: dto.email === undefined ? undefined : dto.email.trim().toLowerCase() || null,
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        designationId: dto.designationId === undefined ? undefined : dto.designationId || null,
      },
      include: { designation: true },
    });
  }

  async archive(organizationId: string, id: string) {
    await this.get(organizationId, id);
    return this.prisma.employee.update({ where: { id }, data: { active: false } });
  }
}
