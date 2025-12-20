import { useState } from 'react';
import { Building, Plus, Search, Edit, Trash2, BarChart3, FolderKanban, Users, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useIBUs,
  useCreateIBU,
  useUpdateIBU,
  useDeleteIBU,
  useIBUSummary,
  IBU,
  IBUCreate,
  IBUUpdate,
} from '@/hooks/useIBUs';
import { useEmployees } from '@/hooks/useEmployees';
import { useFormatting } from '@/hooks/useFormatting';

export default function IBUManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [selectedIBU, setSelectedIBU] = useState<IBU | null>(null);
  
  const { formatCurrency } = useFormatting();
  
  // Form state
  const [formData, setFormData] = useState<IBUCreate>({
    code: '',
    name: '',
    description: '',
    head_id: undefined,
    annual_budget: undefined,
  });
  
  // API hooks
  const { data: ibusResponse, isLoading } = useIBUs({
    search: searchQuery || undefined,
    is_active: showActiveOnly ? true : undefined,
  });
  const { data: employees } = useEmployees();
  const createMutation = useCreateIBU();
  const updateMutation = useUpdateIBU();
  const deleteMutation = useDeleteIBU();
  const { data: ibuSummary, isLoading: summaryLoading } = useIBUSummary(
    selectedIBU?.id || ''
  );
  
  const ibus = ibusResponse?.items || [];
  
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      head_id: undefined,
      annual_budget: undefined,
    });
  };
  
  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Code and Name are required');
      return;
    }
    
    try {
      await createMutation.mutateAsync(formData);
      toast.success('IBU created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create IBU');
    }
  };
  
  const handleEdit = (ibu: IBU) => {
    setSelectedIBU(ibu);
    setFormData({
      code: ibu.code,
      name: ibu.name,
      description: ibu.description || '',
      head_id: ibu.head_id,
      annual_budget: ibu.annual_budget,
    });
    setIsEditDialogOpen(true);
  };
  
  const handleUpdate = async () => {
    if (!selectedIBU) return;
    
    try {
      await updateMutation.mutateAsync({
        ibuId: selectedIBU.id,
        data: formData as IBUUpdate,
      });
      toast.success('IBU updated successfully');
      setIsEditDialogOpen(false);
      setSelectedIBU(null);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update IBU');
    }
  };
  
  const handleDelete = async () => {
    if (!selectedIBU) return;
    
    try {
      await deleteMutation.mutateAsync(selectedIBU.id);
      toast.success('IBU deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedIBU(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete IBU');
    }
  };
  
  const handleToggleActive = async (ibu: IBU) => {
    try {
      await updateMutation.mutateAsync({
        ibuId: ibu.id,
        data: { is_active: !ibu.is_active },
      });
      toast.success(`IBU ${ibu.is_active ? 'deactivated' : 'activated'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update IBU status');
    }
  };
  
  const handleViewSummary = (ibu: IBU) => {
    setSelectedIBU(ibu);
    setIsSummaryDialogOpen(true);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building className="h-6 w-6" />
            IBU Management
          </h1>
          <p className="text-muted-foreground">
            Manage Independent Business Units and track claims by IBU
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create IBU
        </Button>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active-filter"
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
              />
              <Label htmlFor="active-filter">Show active only</Label>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* IBU List */}
      <Card>
        <CardHeader>
          <CardTitle>Business Units</CardTitle>
          <CardDescription>
            {ibus.length} IBU{ibus.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : ibus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No IBUs found</p>
              <p className="text-sm">Create your first IBU to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-center">Projects</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ibus.map((ibu) => (
                  <TableRow key={ibu.id}>
                    <TableCell className="font-mono font-medium">{ibu.code}</TableCell>
                    <TableCell>{ibu.name}</TableCell>
                    <TableCell>{ibu.head_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      {ibu.annual_budget ? formatCurrency(ibu.annual_budget) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{ibu.project_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={ibu.is_active ? 'default' : 'secondary'}>
                        {ibu.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewSummary(ibu)}
                          title="View Summary"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(ibu)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedIBU(ibu);
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedIBU(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? 'Edit IBU' : 'Create New IBU'}
            </DialogTitle>
            <DialogDescription>
              {isEditDialogOpen
                ? 'Update the IBU details below'
                : 'Enter the details for the new IBU'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                placeholder="e.g., IBU-TECH"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Technology Services"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the IBU..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="head">IBU Head</Label>
              <Select
                value={formData.head_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, head_id: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select IBU Head" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees?.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name || emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="budget">Annual Budget</Label>
              <Input
                id="budget"
                type="number"
                placeholder="e.g., 1000000"
                value={formData.annual_budget || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  annual_budget: e.target.value ? parseFloat(e.target.value) : undefined,
                })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedIBU(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isEditDialogOpen ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isEditDialogOpen ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IBU?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedIBU?.name}</strong>?
              This action cannot be undone.
              {selectedIBU?.project_count && selectedIBU.project_count > 0 && (
                <p className="mt-2 text-destructive">
                  Warning: This IBU has {selectedIBU.project_count} project(s) associated.
                  You must reassign or remove them first.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Summary Dialog */}
      <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              IBU Summary: {selectedIBU?.name}
            </DialogTitle>
            <DialogDescription>
              Claim statistics and budget overview for {selectedIBU?.code}
            </DialogDescription>
          </DialogHeader>
          
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : ibuSummary ? (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <FolderKanban className="h-4 w-4" />
                      <span className="text-sm">Projects</span>
                    </div>
                    <p className="text-2xl font-bold">{ibuSummary.project_count}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Total Budget</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(ibuSummary.total_budget)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Total Spent</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(ibuSummary.total_spent)}</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Claims Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Claims Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Claims</p>
                      <p className="text-xl font-semibold">{ibuSummary.claims.total_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-xl font-semibold">
                        {formatCurrency(ibuSummary.claims.total_amount)}
                      </p>
                    </div>
                  </div>
                  
                  {/* By Status */}
                  {Object.keys(ibuSummary.claims.by_status).length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">By Status</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ibuSummary.claims.by_status).map(([status, data]) => (
                          <Badge key={status} variant="outline">
                            {status}: {data.count} ({formatCurrency(data.amount)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* By Category */}
                  {Object.keys(ibuSummary.claims.by_category).length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">By Category</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ibuSummary.claims.by_category).map(([category, data]) => (
                          <Badge key={category} variant="secondary">
                            {category}: {data.count} ({formatCurrency(data.amount)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {ibuSummary.claims.total_count === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No claims found for this IBU
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Failed to load summary
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
