import { useState } from 'react';
import { Plus, Search, Edit, Trash2, MoreHorizontal, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment, Department, DepartmentCreate } from '@/hooks/useDepartments';
import { TableSkeleton } from '@/components/ui/loading-skeleton';

export default function Departments() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [formData, setFormData] = useState<DepartmentCreate>({
        code: '',
        name: '',
        description: '',
        display_order: 0,
    });

    const tenantId = user?.tenantId;
    const { data: departments, isLoading, error } = useDepartments(tenantId, showInactive);
    const createDepartment = useCreateDepartment();
    const updateDepartment = useUpdateDepartment();
    const deleteDepartment = useDeleteDepartment();

    const filteredDepartments = departments?.filter((dept) =>
        dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.code.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const openCreateDialog = () => {
        setEditingDepartment(null);
        setFormData({ code: '', name: '', description: '', display_order: 0 });
        setIsDialogOpen(true);
    };

    const openEditDialog = (dept: Department) => {
        setEditingDepartment(dept);
        setFormData({
            code: dept.code,
            name: dept.name,
            description: dept.description || '',
            display_order: dept.display_order,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.code || !formData.name) {
            toast.error('Code and Name are required');
            return;
        }

        try {
            if (editingDepartment) {
                await updateDepartment.mutateAsync({
                    id: editingDepartment.id,
                    data: formData,
                    tenantId,
                });
                toast.success('Department updated successfully');
            } else {
                await createDepartment.mutateAsync({
                    tenantId: tenantId!,
                    data: formData,
                });
                toast.success('Department created successfully');
            }
            setIsDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        }
    };

    const handleDelete = async (dept: Department) => {
        if (!confirm(`Are you sure you want to delete "${dept.name}"?`)) return;

        try {
            await deleteDepartment.mutateAsync({ id: dept.id, tenantId });
            toast.success('Department deleted successfully');
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete department');
        }
    };

    const handleToggleActive = async (dept: Department) => {
        try {
            await updateDepartment.mutateAsync({
                id: dept.id,
                data: { is_active: !dept.is_active },
                tenantId,
            });
            toast.success(`Department ${dept.is_active ? 'deactivated' : 'activated'}`);
        } catch (err: any) {
            toast.error(err.message || 'Failed to update department');
        }
    };

    if (error) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-destructive">Failed to load departments</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Department Management</h1>
                    <p className="text-muted-foreground">
                        Manage organizational departments
                    </p>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Department
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or code..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="show-inactive"
                                checked={showInactive}
                                onCheckedChange={setShowInactive}
                            />
                            <Label htmlFor="show-inactive">Show inactive</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Department Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        Departments {!isLoading && `(${filteredDepartments.length})`}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <TableSkeleton rows={5} columns={5} />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Employees</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDepartments.map((dept) => (
                                    <TableRow key={dept.id}>
                                        <TableCell className="font-mono text-sm">{dept.code}</TableCell>
                                        <TableCell className="font-medium">{dept.name}</TableCell>
                                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                            {dept.description || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                <span>{dept.employee_count || 0}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={dept.is_active ? 'default' : 'secondary'}>
                                                {dept.is_active ? 'Active' : 'Inactive'}
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
                                                    <DropdownMenuItem onClick={() => openEditDialog(dept)}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggleActive(dept)}>
                                                        {dept.is_active ? 'Deactivate' : 'Activate'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDelete(dept)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredDepartments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <p className="text-muted-foreground">No departments found</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingDepartment ? 'Edit Department' : 'Create Department'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Code *</Label>
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="e.g., ENGG"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Engineering"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Optional description..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="order">Display Order</Label>
                            <Input
                                id="order"
                                type="number"
                                value={formData.display_order}
                                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={createDepartment.isPending || updateDepartment.isPending}
                        >
                            {editingDepartment ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
