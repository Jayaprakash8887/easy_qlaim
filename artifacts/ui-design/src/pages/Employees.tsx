import { useState, useMemo } from 'react';
import { Plus, Search, Upload, MoreHorizontal, Mail, Phone, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEmployees, useCreateEmployee } from '@/hooks/useEmployees';
import { EmployeeForm } from '@/components/forms/EmployeeForm';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { exportToCSV, formatDate } from '@/lib/export-utils';
import { EmployeeFormData } from '@/lib/validations';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusStyles = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  on_leave: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
};

const roleStyles = {
  employee: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  manager: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  hr: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  finance: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function Employees() {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: employees, isLoading, error } = useEmployees();
  const createEmployee = useCreateEmployee();

  const departments = useMemo(() => {
    if (!employees) return [];
    return [...new Set(employees.map((e) => e.department))];
  }, [employees]);

  const managers = useMemo(() => {
    if (!employees) return [];
    return employees
      .filter((e) => e.role === 'manager')
      .map((e) => ({ id: e.id, name: e.name }));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter((employee) => {
      const matchesSearch =
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDepartment =
        departmentFilter === 'all' || employee.department === departmentFilter;
      const matchesStatus =
        statusFilter === 'all' || employee.status === statusFilter;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchQuery, departmentFilter, statusFilter]);

  const handleAddEmployee = async (data: EmployeeFormData) => {
    try {
      await createEmployee.mutateAsync({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        employeeId: `EMP-${Date.now()}`,
        department: data.department,
        role: data.role,
        status: 'active',
        joinDate: new Date(),
        managerId: data.managerId,
        projectIds: [],
      });
      toast.success('Employee added successfully');
      setIsAddDialogOpen(false);
    } catch {
      toast.error('Failed to add employee');
    }
  };

  const handleExport = () => {
    if (!filteredEmployees.length) {
      toast.error('No employees to export');
      return;
    }
    exportToCSV(
      filteredEmployees.map((e) => ({
        employeeId: e.employeeId,
        name: e.name,
        email: e.email,
        department: e.department,
        role: e.role,
        status: e.status,
        joinDate: formatDate(e.joinDate),
      })),
      'employees',
      [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department' },
        { key: 'role', label: 'Role' },
        { key: 'status', label: 'Status' },
        { key: 'joinDate', label: 'Join Date' },
      ]
    );
    toast.success('Employees exported successfully');
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">Failed to load employees</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Management</h1>
          <p className="text-muted-foreground">
            Manage employee directory and assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <EmployeeForm
                departments={departments}
                managers={managers}
                onSubmit={handleAddEmployee}
                onCancel={() => setIsAddDialogOpen(false)}
                isLoading={createEmployee.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Employees {!isLoading && `(${filteredEmployees.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {employee.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {employee.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {employee.employeeId}
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={roleStyles[employee.role]}>
                        {employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(employee.joinDate, 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusStyles[employee.status]}>
                        {employee.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Phone className="mr-2 h-4 w-4" />
                            Call
                          </DropdownMenuItem>
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">No employees found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
