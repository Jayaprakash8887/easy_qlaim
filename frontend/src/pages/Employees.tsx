import { useState, useMemo, useRef } from 'react';
import { Plus, Search, Upload, MoreHorizontal, Mail, Phone, Download, FileDown, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDepartments } from '@/hooks/useDepartments';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEmployees, useCreateEmployee, useUpdateEmployee } from '@/hooks/useEmployees';
import { useProjects } from '@/hooks/useProjects';
import { EmployeeForm } from '@/components/forms/EmployeeForm';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { exportToCSV, formatDate } from '@/lib/export-utils';
import { EmployeeFormData } from '@/lib/validations';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tenantId = user?.tenantId;

  // Filter employees by current user's tenant
  const { data: employees, isLoading, error } = useEmployees(tenantId);
  const { data: projects } = useProjects(tenantId);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  // Get departments from API (tenant-specific)
  const { data: departmentsData } = useDepartments(tenantId);

  // Map departments to array of names for filters and forms
  const departments = useMemo(() => {
    if (!departmentsData || departmentsData.length === 0) {
      // Fallback: get unique departments from existing employees
      if (!employees) return [];
      return [...new Set(employees.map((e) => e.department).filter(Boolean))];
    }
    return departmentsData.map((d) => d.name);
  }, [departmentsData, employees]);

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
        tenantId: tenantId,
        employeeId: data.employeeId || `EMP${Date.now()}`,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || '',
        mobile: data.mobile,
        address: data.address || '',
        department: data.department,
        designation: data.designation || data.role,
        region: data.region?.trim() || undefined,
        joinDate: data.dateOfJoining || format(new Date(), 'yyyy-MM-dd'),
        managerId: data.managerId || undefined,
        projectIds: data.projectIds || '',
      });
      toast.success('Employee added successfully');
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Failed to add employee:', error);
      toast.error('Failed to add employee');
    }
  };

  const handleEditEmployee = (employee: any) => {
    setSelectedEmployee(employee);
    setIsEditDialogOpen(true);
  };
  const handleUpdateEmployee = async (data: EmployeeFormData) => {
    if (!selectedEmployee) return;

    try {
      await updateEmployee.mutateAsync({
        id: selectedEmployee.id,
        data: {
          employeeId: data.employeeId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || '',
          mobile: data.mobile,
          address: data.address || '',
          department: data.department,
          designation: data.designation || data.role,
          region: data.region?.trim() || undefined,
          joinDate: data.dateOfJoining || selectedEmployee.joinDate,
          managerId: data.managerId || undefined,
          projectIds: data.projectIds || '',
        }
      });
      toast.success('Employee updated successfully');
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Failed to update employee:', error);
      toast.error('Failed to update employee');
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

  // Parse CSV content into rows
  const parseCSV = (content: string): Record<string, string>[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
    return rows;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResults(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportResults(null);

    try {
      const content = await importFile.text();
      const rows = parseCSV(content);

      if (rows.length === 0) {
        toast.error('No valid data found in CSV');
        setIsImporting(false);
        return;
      }

      // Transform CSV rows to employee format for bulk API
      const employees = rows.map(row => ({
        employee_id: row.employee_id || `EMP${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        email: row.email || '',
        phone: row.phone || '',
        mobile: row.mobile || '',
        address: row.address || '',
        department: row.department || 'Engineering',
        designation: row.designation || 'Employee',
        region: row.region ? [row.region] : undefined,
        date_of_joining: row.join_date || format(new Date(), 'yyyy-MM-dd'),
        manager_id: row.manager_id || undefined,
        project_ids: row.project_ids ? [row.project_ids] : [],
      }));

      // Call bulk import API
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${API_BASE_URL}/employees/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          employees: employees,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Bulk import failed');
      }

      const result = await response.json();

      // Map API response to our format
      const errors = result.results
        .filter((r: any) => !r.success)
        .map((r: any) => `${r.employee_id}: ${r.error}`);

      setImportResults({
        success: result.success_count,
        failed: result.failed_count,
        errors
      });

      if (result.success_count > 0) {
        toast.success(`Successfully imported ${result.success_count} employee(s)`);
        // Invalidate and refetch employees list
        queryClient.invalidateQueries({ queryKey: ['employees'] });
      }
      if (result.failed_count > 0) {
        toast.error(`Failed to import ${result.failed_count} employee(s)`);
      }

    } catch (err) {
      toast.error('Failed to import employees');
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const resetImportDialog = () => {
    setImportFile(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          <Button variant="outline" size="sm" onClick={() => { setIsImportDialogOpen(true); resetImportDialog(); }}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>

          {/* Import Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Import Employees from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file to bulk import employees.
                  <a
                    href="/sample-employees.csv"
                    download
                    className="text-primary hover:underline ml-1 inline-flex items-center gap-1"
                  >
                    <FileDown className="h-3 w-3" />
                    Download sample CSV
                  </a>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {importFile ? importFile.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CSV file only
                    </p>
                  </label>
                </div>

                {importResults && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm">{importResults.success} imported successfully</span>
                    </div>
                    {importResults.failed > 0 && (
                      <>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="text-sm">{importResults.failed} failed</span>
                        </div>
                        {importResults.errors.slice(0, 3).map((err, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground pl-6">{err}</p>
                        ))}
                        {importResults.errors.length > 3 && (
                          <p className="text-xs text-muted-foreground pl-6">...and {importResults.errors.length - 3} more errors</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                  {importResults ? 'Close' : 'Cancel'}
                </Button>
                {!importResults && (
                  <Button
                    onClick={handleImport}
                    disabled={!importFile || isImporting}
                  >
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isImporting ? 'Importing...' : 'Import'}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <EmployeeForm
                departments={departments}
                managers={managers}
                projects={projects || []}
                onSubmit={handleAddEmployee}
                onCancel={() => setIsAddDialogOpen(false)}
                isLoading={createEmployee.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeForm
              departments={departments}
              managers={managers}
              projects={projects || []}
              onSubmit={handleUpdateEmployee}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedEmployee(null);
              }}
              isLoading={updateEmployee.isPending}
              currentEmployeeId={selectedEmployee.id}
              defaultValues={{
                employeeId: selectedEmployee.employeeId,
                firstName: selectedEmployee.firstName || selectedEmployee.name?.split(' ')[0] || '',
                lastName: selectedEmployee.lastName || selectedEmployee.name?.split(' ')[1] || '',
                email: selectedEmployee.email,
                phone: selectedEmployee.phone || '',
                mobile: selectedEmployee.mobile || '',
                address: selectedEmployee.address || '',
                department: selectedEmployee.department,
                designation: selectedEmployee.designation || '',
                region: selectedEmployee.region || '',
                dateOfJoining: selectedEmployee.joinDate || '',
                managerId: selectedEmployee.managerId || '',
                projectIds: selectedEmployee.projectIds?.[0] || '',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
                  <TableHead>Region</TableHead>
                  <TableHead>Role</TableHead>
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
                      <Badge variant="outline">
                        {employee.region || 'Global'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={roleStyles[employee.role]}>
                        {employee.role}
                      </Badge>
                    </TableCell>
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
                          <DropdownMenuItem onClick={() => navigate(`/employees/${employee.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                            Edit
                          </DropdownMenuItem>
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
