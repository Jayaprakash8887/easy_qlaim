import { useState } from 'react';
import {
    Building2,
    Plus,
    Globe,
    Users,
    Settings,
    CheckCircle,
    XCircle,
    Edit,
    Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useTenants,
    useCreateTenant,
    useUpdateTenant,
    useTenantUsers,
    Tenant,
    TenantCreate
} from '@/hooks/useSystemAdmin';

function TenantFormDialog({
    open,
    onOpenChange,
    tenant
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenant?: Tenant;
}) {
    const [formData, setFormData] = useState<TenantCreate>({
        name: tenant?.name || '',
        code: tenant?.code || '',
        domain: tenant?.domain || '',
    });

    const createTenant = useCreateTenant();
    const updateTenant = useUpdateTenant();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (tenant) {
                await updateTenant.mutateAsync({ id: tenant.id, data: formData });
                toast.success('Tenant updated successfully');
            } else {
                await createTenant.mutateAsync(formData);
                toast.success('Tenant created successfully');
            }
            onOpenChange(false);
            setFormData({ name: '', code: '', domain: '' });
        } catch (error: any) {
            toast.error(error.message || 'Operation failed');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{tenant ? 'Edit Tenant' : 'Create New Tenant'}</DialogTitle>
                    <DialogDescription>
                        {tenant ? 'Update tenant details below.' : 'Add a new organization to the platform.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Organization Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Acme Corporation"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="code">Tenant Code *</Label>
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="ACME"
                                maxLength={20}
                                required
                                disabled={!!tenant}
                            />
                            <p className="text-xs text-muted-foreground">
                                Unique identifier for the tenant (max 20 characters)
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="domain">Email Domain</Label>
                            <Input
                                id="domain"
                                value={formData.domain || ''}
                                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                placeholder="acme.com"
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional: Auto-associate users with this email domain
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={createTenant.isPending || updateTenant.isPending}
                        >
                            {createTenant.isPending || updateTenant.isPending ? 'Saving...' : tenant ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function TenantUsersDialog({ tenant }: { tenant: Tenant }) {
    const [open, setOpen] = useState(false);
    const { data: users, isLoading } = useTenantUsers(tenant.id);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <Users className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Users in {tenant.name}</DialogTitle>
                    <DialogDescription>
                        Employees associated with this tenant organization.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : users && users.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user: any) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.first_name} {user.last_name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.designation || '-'}</TableCell>
                                        <TableCell>
                                            {user.is_active ? (
                                                <Badge variant="default">Active</Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No users found</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function Tenants() {
    const [showInactive, setShowInactive] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editTenant, setEditTenant] = useState<Tenant | undefined>();

    const { data: tenants, isLoading, error } = useTenants(showInactive);
    const updateTenant = useUpdateTenant();

    const handleToggleActive = async (tenant: Tenant) => {
        try {
            await updateTenant.mutateAsync({
                id: tenant.id,
                data: { is_active: !tenant.is_active }
            });
            toast.success(`Tenant ${tenant.is_active ? 'deactivated' : 'activated'} successfully`);
        } catch (error) {
            toast.error('Failed to update tenant status');
        }
    };

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-destructive">Error loading tenants: {(error as Error).message}</p>
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
                        <Building2 className="h-8 w-8 text-primary" />
                        Tenant Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage organizations using the platform
                    </p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tenant
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenants?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {tenants?.filter(t => t.is_active).length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inactive Tenants</CardTitle>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">
                            {tenants?.filter(t => !t.is_active).length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tenants Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Organizations</CardTitle>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="showInactive" className="text-sm">Show inactive</Label>
                            <input
                                id="showInactive"
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                        </div>
                    </div>
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
                                    <TableHead>Organization</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants?.map((tenant) => (
                                    <TableRow key={tenant.id}>
                                        <TableCell className="font-medium">{tenant.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{tenant.code}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {tenant.domain ? (
                                                <span className="flex items-center gap-1">
                                                    <Globe className="h-3 w-3" />
                                                    {tenant.domain}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {tenant.is_active ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(tenant.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <TenantUsersDialog tenant={tenant} />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditTenant(tenant)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleActive(tenant)}
                                                >
                                                    {tenant.is_active ? (
                                                        <XCircle className="h-4 w-4 text-destructive" />
                                                    ) : (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!tenants || tenants.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No tenants found. Click "Add Tenant" to create one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <TenantFormDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            {/* Edit Dialog */}
            {editTenant && (
                <TenantFormDialog
                    open={!!editTenant}
                    onOpenChange={(open) => !open && setEditTenant(undefined)}
                    tenant={editTenant}
                />
            )}
        </div>
    );
}
