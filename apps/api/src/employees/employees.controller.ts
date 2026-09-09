import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AuthRequest } from '../auth/types/auth-request';

@Controller('employees')
@UseGuards(SessionGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  private organizationId(req: AuthRequest): string {
    const id = req.user.employee?.organizationId;
    if (!id) throw new Error('Authenticated employee is not associated with an organization');
    return id;
  }

  @Get()
  list(@Req() req: AuthRequest) { return this.employees.list(this.organizationId(req)); }

  @Get(':id')
  get(@Req() req: AuthRequest, @Param('id') id: string) { return this.employees.get(this.organizationId(req), id); }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateEmployeeDto) { return this.employees.create(this.organizationId(req), dto); }

  @Put(':id')
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) { return this.employees.update(this.organizationId(req), id, dto); }

  @Delete(':id')
  archive(@Req() req: AuthRequest, @Param('id') id: string) { return this.employees.archive(this.organizationId(req), id); }
}
