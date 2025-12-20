import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAllDepartments } from '@/config/company';
import { ArrowLeft, Mail, Phone, Calendar, MapPin, Briefcase, Edit2, UserCheck, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmployee, useUpdateEmployee, useEmployees } from '@/hooks/useEmployees';
import { useClaims } from '@/hooks/useClaims';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { EmployeeForm } from '@/components/forms/EmployeeForm';
import { EmployeeFormData } from '@/lib/validations';
import { toast } from 'sonner';
import { useFormatting } from '@/hooks/useFormatting';

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

const claimStatusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  paid: 'bg-purple-100 text-purple-800',
};

export default function EmployeeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const { formatDate, formatCurrency } = useFormatting();

  const { data: employee, isLoading: employeeLoading } = useEmployee(id || '');
  const { data: allEmployees } = useEmployees(tenantId);
  const { data: allClaims } = useClaims(tenantId);
  const { data: allProjects } = useProjects(tenantId);
  const updateEmployee = useUpdateEmployee();

  const employeeClaims = allClaims?.filter((claim) => claim.employeeId === id) || [];
  const employeeProjects = allProjects?.filter((project) =>
    employee?.projectIds?.includes(project.id) || project.managerId === id
  ) || [];
  const manager = allEmployees?.find((emp) => emp.id === employee?.managerId);

  const handleUpdateEmployee = async (data: EmployeeFormData) => {
    if (!employee) return;

    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
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
          region: data.region || '',  // Region/location for policy applicability
          joinDate: data.dateOfJoining || employee.joinDate,
          managerId: data.managerId || undefined,
          projectIds: data.projectIds || '',
          role: data.role,  // Send role to backend for updating
        }
      });
      toast.success('Employee updated successfully');
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to update employee:', error);
      toast.error('Failed to update employee');
    }
  };

  if (employeeLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex justify-center">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Employee Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">The employee you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const departments = getAllDepartments();
  const managers = allEmployees?.filter((emp) => emp.role === 'manager').map((emp) => ({
    id: emp.id,
    name: emp.name,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employee Details</h1>
            <p className="text-sm text-muted-foreground">View and manage employee information</p>
          </div>
        </div>
        <Button onClick={() => setIsEditDialogOpen(true)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Edit Employee
        </Button>
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            departments={departments}
            managers={managers}
            projects={allProjects || []}
            onSubmit={handleUpdateEmployee}
            onCancel={() => setIsEditDialogOpen(false)}
            isLoading={updateEmployee.isPending}
            currentEmployeeId={employee.id}
            defaultValues={{
              employeeId: employee.employeeId,
              firstName: employee.firstName || employee.name?.split(' ')[0] || '',
              lastName: employee.lastName || employee.name?.split(' ')[1] || '',
              email: employee.email,
              phone: employee.phone || '',
              mobile: employee.mobile || '',
              address: employee.address || '',
              department: employee.department,
              designation: employee.designation || '',
              region: employee.region || '',
              dateOfJoining: employee.joinDate || '',
              managerId: employee.managerId || '',
              projectIds: employee.projectIds?.[0] || '',
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Employee Info Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {employee.name.split(' ').map((n) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{employee.name}</h2>
                  <p className="text-muted-foreground">{employee.designation || employee.role}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className={roleStyles[employee.role]}>
                    {employee.role}
                  </Badge>
                  <Badge variant="secondary" className={statusStyles[employee.status]}>
                    {employee.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <UserCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Employee ID</p>
                  <p className="text-sm text-muted-foreground font-mono">{employee.employeeId}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{employee.email}</p>
                </div>
              </div>
              {employee.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{employee.phone}</p>
                  </div>
                </div>
              )}
              {employee.mobile && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Mobile</p>
                    <p className="text-sm text-muted-foreground">{employee.mobile}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Department</p>
                  <p className="text-sm text-muted-foreground">{employee.department}</p>
                </div>
              </div>
              {employee.designation && (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Designation</p>
                    <p className="text-sm text-muted-foreground">{employee.designation}</p>
                  </div>
                </div>
              )}
              {manager && (
                <div className="flex items-start gap-3">
                  <UserCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Reporting Manager</p>
                    <p className="text-sm text-muted-foreground">{manager.name}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Join Date</p>
                  <p className="text-sm text-muted-foreground">
                    {employee.joinDate ? formatDate(employee.joinDate) : 'N/A'}
                  </p>
                </div>
              </div>
              {employee.address && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">{employee.address}</p>
                  </div>
                </div>
              )}
              {employeeProjects.length > 0 && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <FolderKanban className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Project Allocations</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {employeeProjects.map((project) => (
                        <Badge key={project.id} variant="outline" className="text-xs">
                          {project.name} ({project.code})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold">{employeeClaims.length}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold">
                  {employeeProjects.filter((p) => p.status === 'active').length}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Total Amount Claimed</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(employeeClaims.reduce((sum, claim) => sum + claim.amount, 0))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Projects */}
      {employeeProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {employeeProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{project.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {project.code}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      project.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : project.status === 'completed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {project.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Claims */}
      {employeeClaims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {employeeClaims.slice(0, 5).map((claim) => (
                <div key={claim.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{claim.category}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(claim.submittedDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{formatCurrency(claim.amount)}</p>
                    <Badge variant="secondary" className={claimStatusColors[claim.status]}>
                      {claim.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
