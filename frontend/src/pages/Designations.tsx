import { useState } from 'react';
import {
    Briefcase,
    Plus,
    Shield,
    Edit,
    CheckCircle,
    XCircle,
    Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useTenants,
    useDesignations,
    useAvailableRoles,
    useCreateDesignation,
    useUpdateDesignation,
    useSetDesignationRoles,
    Designation,
    DesignationCreate,
} from '@/hooks/useSystemAdmin';

const roleColors: Record<string, string> = {
    EMPLOYEE: 'bg-gray-100 text-gray-800',
    MANAGER: 'bg-blue-100 text-blue-800',
    HR: 'bg-purple-100 text-purple-800',
    FINANCE: 'bg-green-100 text-green-800',
    ADMIN: 'bg-orange-100 text-orange-800',
};

function DesignationFormDialog({
    open,
    onOpenChange,
    designation,
    tenantId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    designation?: Designation;
    tenantId?: string;
}) {
    const [formData, setFormData] = useState<DesignationCreate>({
        name: designation?.name || '',
        code: designation?.code || '',
        description: designation?.description || '',
        level: designation?.level || 0,
    });

    const createDesignation = useCreateDesignation();
    const updateDesignation = useUpdateDesignation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (designation) {
                await updateDesignation.mutateAsync({ id: designation.id, data: formData });
                toast.success('Designation updated successfully');
            } else {
                await createDesignation.mutateAsync({ data: formData, tenantId });
                toast.success('Designation created successfully');
            }
            onOpenChange(false);
            setFormData({ name: '', code: '', description: '', level: 0 });
        } catch (error: any) {
            toast.error(error.message || 'Operation failed');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{designation ? 'Edit Designation' : 'Create New Designation'}</DialogTitle>
                    <DialogDescription>
                        {designation ? 'Update designation details below.' : 'Add a new job designation.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Designation Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Senior Project Manager"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="code">Code *</Label>
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                                placeholder="SR_PM"
                                maxLength={50}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe this designation..."
                                rows={3}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="level">Hierarchy Level</Label>
                            <Input
                                id="level"
                                type="number"
                                value={formData.level || 0}
                                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 0 })}
                                min={0}
                            />
                            <p className="text-xs text-muted-foreground">
                                Lower numbers = higher in hierarchy (0 = top level)
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={createDesignation.isPending || updateDesignation.isPending}
                        >
                            {createDesignation.isPending || updateDesignation.isPending ? 'Saving...' : designation ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RoleMappingDialog({
    designation,
    open,
    onOpenChange
}: {
    designation: Designation;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { data: availableRoles } = useAvailableRoles();
    const setRoles = useSetDesignationRoles();
    const [selectedRoles, setSelectedRoles] = useState<string[]>(designation.roles || []);

    const handleSave = async () => {
        try {
            await setRoles.mutateAsync({ designationId: designation.id, roles: selectedRoles });
            toast.success('Roles updated successfully');
            onOpenChange(false);
        } catch (error) {
            toast.error('Failed to update roles');
        }
    };

    const toggleRole = (role: string) => {
        if (selectedRoles.includes(role)) {
            setSelectedRoles(selectedRoles.filter(r => r !== role));
        } else {
            setSelectedRoles([...selectedRoles, role]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Manage Roles for "{designation.name}"</DialogTitle>
                    <DialogDescription>
                        Select which application roles this designation should have.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <div className="space-y-3">
                        {availableRoles?.map((role) => (
                            <div
                                key={role}
                                className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                                onClick={() => toggleRole(role)}
                            >
                                <Checkbox
                                    checked={selectedRoles.includes(role)}
                                    onCheckedChange={() => toggleRole(role)}
                                />
                                <div className="flex-1">
                                    <Badge className={roleColors[role] || 'bg-gray-100'}>
                                        {role}
                                    </Badge>
                                </div>
                                <Shield className="h-4 w-4 text-muted-foreground" />
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        Note: SYSTEM_ADMIN role cannot be assigned to designations.
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={setRoles.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        {setRoles.isPending ? 'Saving...' : 'Save Roles'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function Designations() {
    const [selectedTenantId, setSelectedTenantId] = useState<string>('');
    const [showInactive, setShowInactive] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDesignation, setEditDesignation] = useState<Designation | undefined>();
    const [roleDesignation, setRoleDesignation] = useState<Designation | undefined>();

    const { data: tenants } = useTenants();
    const { data: designations, isLoading, error } = useDesignations(
        selectedTenantId || undefined,
        showInactive
    );
    const updateDesignation = useUpdateDesignation();

    // Auto-select first tenant
    if (tenants && tenants.length > 0 && !selectedTenantId) {
        setSelectedTenantId(tenants[0].id);
    }

    const handleToggleActive = async (designation: Designation) => {
        try {
            await updateDesignation.mutateAsync({
                id: designation.id,
                data: { is_active: !designation.is_active }
            });
            toast.success(`Designation ${designation.is_active ? 'deactivated' : 'activated'}`);
        } catch (error) {
            toast.error('Failed to update designation status');
        }
    };

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-destructive">Error loading designations: {(error as Error).message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Briefcase className="h-8 w-8 text-primary" />
                        Designation Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage job designations and their role mappings
                    </p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)} disabled={!selectedTenantId}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Designation
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-xs">
                            <Label htmlFor="tenant">Tenant</Label>
                            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select tenant" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tenants?.map((tenant) => (
                                        <SelectItem key={tenant.id} value={tenant.id}>
                                            {tenant.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <Checkbox
                                id="showInactive"
                                checked={showInactive}
                                onCheckedChange={(checked) => setShowInactive(!!checked)}
                            />
                            <Label htmlFor="showInactive" className="text-sm">Show inactive</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Designations</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{designations?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">With Manager Role</CardTitle>
                        <Shield className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {designations?.filter(d => d.roles.includes('MANAGER')).length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">With HR Role</CardTitle>
                        <Shield className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                            {designations?.filter(d => d.roles.includes('HR')).length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">With Finance Role</CardTitle>
                        <Shield className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {designations?.filter(d => d.roles.includes('FINANCE')).length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Designations Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Designations</CardTitle>
                    <CardDescription>
                        Configure which application roles each designation has access to.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead>Roles</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {designations?.map((designation) => (
                                    <TableRow key={designation.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{designation.name}</div>
                                                {designation.description && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {designation.description}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{designation.code}</Badge>
                                        </TableCell>
                                        <TableCell>{designation.level}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {designation.roles.length > 0 ? (
                                                    designation.roles.map((role) => (
                                                        <Badge
                                                            key={role}
                                                            className={`${roleColors[role] || 'bg-gray-100'} text-xs`}
                                                        >
                                                            {role}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">No roles</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {designation.is_active ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setRoleDesignation(designation)}
                                                    title="Manage Roles"
                                                >
                                                    <Shield className="h-4 w-4 text-primary" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditDesignation(designation)}
                                                    title="Edit"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleActive(designation)}
                                                    title={designation.is_active ? 'Deactivate' : 'Activate'}
                                                >
                                                    {designation.is_active ? (
                                                        <XCircle className="h-4 w-4 text-destructive" />
                                                    ) : (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!designations || designations.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No designations found. Click "Add Designation" to create one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <DesignationFormDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                tenantId={selectedTenantId}
            />

            {/* Edit Dialog */}
            {editDesignation && (
                <DesignationFormDialog
                    open={!!editDesignation}
                    onOpenChange={(open) => !open && setEditDesignation(undefined)}
                    designation={editDesignation}
                    tenantId={selectedTenantId}
                />
            )}

            {/* Role Mapping Dialog */}
            {roleDesignation && (
                <RoleMappingDialog
                    designation={roleDesignation}
                    open={!!roleDesignation}
                    onOpenChange={(open) => !open && setRoleDesignation(undefined)}
                />
            )}
        </div>
    );
}
