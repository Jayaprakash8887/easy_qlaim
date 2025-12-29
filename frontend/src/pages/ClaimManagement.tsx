import { useState } from 'react';
import { extractErrorMessage } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Loader2,
    AlertCircle,
    Edit,
    Clock,
    CheckCircle,
    XCircle,
    FileCheck,
    Search
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRegions } from '@/hooks/useRegions';
import { useFormatting } from '@/hooks/useFormatting';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Types
interface ExtractedClaim {
    id: string;
    category_name: string;
    category_code: string;
    category_type: 'REIMBURSEMENT' | 'ALLOWANCE';
    description?: string;
    max_amount?: number;
    currency: string;
    requires_receipt: boolean;
    is_active: boolean;
    ai_confidence?: number;
    created_at: string;
    policy_upload_id: string;
    policy_name: string;
    policy_status: string;
    policy_version?: string;
    policy_effective_from?: string;
    policy_region?: string;
}

// API Functions
async function fetchExtractedClaims(tenantId?: string): Promise<ExtractedClaim[]> {
    const params = tenantId ? `?tenant_id=${tenantId}` : '';
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/policies/extracted-claims${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!response.ok) {
        throw new Error('Failed to fetch extracted claims');
    }
    return response.json();
}

async function updateCategory(id: string, updates: Partial<ExtractedClaim>, tenantId?: string): Promise<ExtractedClaim> {
    const params = tenantId ? `?tenant_id=${tenantId}` : '';
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/policies/categories/${id}${params}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Failed to update category'));
    }
    return response.json();
}

function getPolicyStatusBadge(status: string) {
    switch (status) {
        case 'PENDING':
            return <Badge variant="outline" className="text-gray-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
        case 'AI_PROCESSING':
            return <Badge variant="outline" className="text-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
        case 'EXTRACTED':
            return <Badge variant="outline" className="text-orange-600"><AlertCircle className="h-3 w-3 mr-1" />Needs Review</Badge>;
        case 'APPROVED':
            return <Badge variant="outline" className="text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
        case 'ACTIVE':
            return <Badge className="bg-green-100 text-green-700"><FileCheck className="h-3 w-3 mr-1" />Active</Badge>;
        case 'REJECTED':
            return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

// Region options removed - using dynamic regions

export default function ClaimManagement() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { data: regions } = useRegions();
    const { formatCurrency } = useFormatting();

    // Use region code as value (backend stores codes), but show name as label
    const regionOptions = [
        { value: '', label: 'All Regions' },
        ...(regions || []).map(r => ({ value: r.code, label: r.name }))
    ];

    // Helper function to convert region codes to display names
    const getRegionDisplayName = (regionCode: string | string[] | null | undefined): string => {
        if (!regionCode) return 'Global';
        const codes = Array.isArray(regionCode) ? regionCode : [regionCode];
        if (codes.length === 0) return 'Global';
        
        return codes.map(code => {
            if (code === 'GLOBAL') return 'Global';
            const region = regions?.find(r => r.code === code);
            return region?.name || code;
        }).join(', ');
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ExtractedClaim | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<ExtractedClaim>>({});

    const { data: claims, isLoading, error } = useQuery({
        queryKey: ['extracted-claims', user?.tenantId],
        queryFn: () => fetchExtractedClaims(user?.tenantId),
        enabled: !!user?.tenantId,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<ExtractedClaim> }) =>
            updateCategory(id, updates, user?.tenantId),
        onSuccess: () => {
            toast({ title: 'Success', description: 'Category updated successfully.' });
            setIsEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ['extracted-claims'] });
            // Also invalidate individual policy queries so the "Extracted Categories" 
            // dialog in Policies page shows the updated values
            queryClient.invalidateQueries({ queryKey: ['policy'] });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const handleEditClick = (category: ExtractedClaim) => {
        setSelectedCategory(category);
        setEditForm({
            category_name: category.category_name,
            category_code: category.category_code,
            category_type: category.category_type,
            max_amount: category.max_amount,
            requires_receipt: category.requires_receipt,
            description: category.description,
        });
        setIsEditOpen(true);
    };

    const handleSaveEdit = () => {
        if (!selectedCategory) return;
        updateMutation.mutate({ id: selectedCategory.id, updates: editForm });
    };

    const filteredClaims = claims?.filter(claim => {
        const matchesSearch = claim.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            claim.policy_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            claim.category_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRegion = !regionFilter || regionFilter === ' ' || claim.policy_region === regionFilter;
        return matchesSearch && matchesRegion;
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-destructive">
                <AlertCircle className="h-8 w-8 mr-2" />
                <span>Failed to load claims</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Claim Management</h1>
                <p className="text-muted-foreground">
                    View and manage extracted claims from all policy documents
                </p>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search claims or policies..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-48">
                    <Select value={regionFilter} onValueChange={setRegionFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter by Region" />
                        </SelectTrigger>
                        <SelectContent>
                            {regionOptions.map((option) => (
                                <SelectItem key={option.value || 'all'} value={option.value || ' '}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Claims Table */}
            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base">Extracted Claims ({filteredClaims?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Policy</TableHead>
                                <TableHead>Region</TableHead>
                                <TableHead>Category Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Max Amount</TableHead>
                                <TableHead>Receipt</TableHead>
                                <TableHead>Policy Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClaims?.map((claim) => (
                                <TableRow key={claim.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium text-sm">{claim.policy_name}</p>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                {claim.policy_version && <span>{claim.policy_version}</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {getRegionDisplayName(claim.policy_region)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{claim.category_name}</p>
                                            <p className="text-xs text-muted-foreground">{claim.category_code}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={claim.category_type === 'REIMBURSEMENT' ? 'default' : 'secondary'} className="text-xs">
                                            {claim.category_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {claim.max_amount ? formatCurrency(claim.max_amount) : <span className="text-muted-foreground text-sm">Unlimited</span>}
                                    </TableCell>
                                    <TableCell>
                                        <span className={claim.requires_receipt ? "text-green-600 font-medium text-sm" : "text-muted-foreground text-sm"}>
                                            {claim.requires_receipt ? 'Required' : 'Optional'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {getPolicyStatusBadge(claim.policy_status)}
                                    </TableCell>
                                    <TableCell className="text-right border-l pl-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditClick(claim)}
                                            title="Edit Category"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredClaims?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        No claims found matching your search.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Claim Category</DialogTitle>
                        <DialogDescription>
                            Modify extracted claim details. Changes will be reflected in the policy.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category_name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="category_name"
                                value={editForm.category_name || ''}
                                onChange={(e) => setEditForm({ ...editForm, category_name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category_code" className="text-right">
                                Code
                            </Label>
                            <Input
                                id="category_code"
                                value={editForm.category_code || ''}
                                onChange={(e) => setEditForm({ ...editForm, category_code: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type
                            </Label>
                            <div className="col-span-3">
                                <Select
                                    value={editForm.category_type}
                                    onValueChange={(value: any) => setEditForm({ ...editForm, category_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
                                        <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="max_amount" className="text-right">
                                Max Amount
                            </Label>
                            <Input
                                id="max_amount"
                                type="number"
                                value={editForm.max_amount || ''}
                                onChange={(e) => setEditForm({ ...editForm, max_amount: parseFloat(e.target.value) || undefined })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">
                                Receipt
                            </Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <Checkbox
                                    id="requires_receipt"
                                    checked={editForm.requires_receipt}
                                    onCheckedChange={(checked) => setEditForm({ ...editForm, requires_receipt: checked === true })}
                                />
                                <label
                                    htmlFor="requires_receipt"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Required
                                </label>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Input
                                id="description"
                                value={editForm.description || ''}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
