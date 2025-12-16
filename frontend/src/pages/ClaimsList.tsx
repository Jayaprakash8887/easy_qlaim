import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { AIConfidenceBadge } from '@/components/claims/AIConfidenceBadge';
import { useClaims, useDeleteClaim } from '@/hooks/useClaims';
import { toast } from '@/hooks/use-toast';
import { ClaimStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const statusOptions: { value: ClaimStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'pending_manager', label: 'Pending Manager' },
  { value: 'pending_hr', label: 'Pending HR' },
  { value: 'pending_finance', label: 'Pending Finance' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'returned', label: 'Returned' },
  { value: 'settled', label: 'Settled' },
];

// Helper function to format category for display
const formatCategory = (category: string): string => {
  const categoryMap: Record<string, string> = {
    // Backend uppercase categories
    'TEAM_LUNCH': 'Team Lunch',
    'FOOD': 'Food & Meals',
    'TRAVEL': 'Travel',
    'CERTIFICATION': 'Certification',
    'ACCOMMODATION': 'Accommodation',
    'EQUIPMENT': 'Equipment',
    'SOFTWARE': 'Software',
    'OFFICE_SUPPLIES': 'Office Supplies',
    'MEDICAL': 'Medical',
    'MOBILE': 'Phone & Internet',
    'PASSPORT_VISA': 'Passport & Visa',
    'CONVEYANCE': 'Conveyance',
    'CLIENT_MEETING': 'Client Meeting',
    'OTHER': 'Other',
    // Frontend lowercase categories
    'team_lunch': 'Team Lunch',
    'food': 'Food & Meals',
    'travel': 'Travel',
    'certification': 'Certification',
    'accommodation': 'Accommodation',
    'equipment': 'Equipment',
    'software': 'Software',
    'office_supplies': 'Office Supplies',
    'medical': 'Medical',
    'phone_internet': 'Phone & Internet',
    'passport_visa': 'Passport & Visa',
    'conveyance': 'Conveyance',
    'client_meeting': 'Client Meeting',
    'other': 'Other',
    // Legacy mappings
    'RELOCATION': 'Other',
    'INTERNET': 'Software',
  };
  return categoryMap[category] || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const ITEMS_PER_PAGE = 10;

export default function ClaimsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const { user } = useAuth();
  const { data: claims = [], isLoading, error, refetch } = useClaims();
  const deleteClaim = useDeleteClaim();

  const handleDeleteClaim = async (claimId: string, claimNumber: string) => {
    if (!confirm(`Are you sure you want to delete claim ${claimNumber}?`)) {
      return;
    }
    
    try {
      await deleteClaim.mutateAsync(claimId);
      toast({
        title: "Claim Deleted",
        description: `Claim ${claimNumber} has been deleted successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete claim. Only draft claims can be deleted.",
        variant: "destructive",
      });
    }
  };

  const filteredClaims = useMemo(() => {
    // Filter by current user's employee ID if available
    let result = user?.id 
      ? claims.filter(claim => claim.employeeId === user.id)
      : claims;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (claim) =>
          (claim.title?.toLowerCase() || '').includes(query) ||
          (claim.claimNumber?.toLowerCase() || '').includes(query) ||
          (claim.description?.toLowerCase() || '').includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((claim) => claim.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      const aDate = a.claimDate || a.submissionDate || new Date();
      const bDate = b.claimDate || b.submissionDate || new Date();
      const aVal = sortField === 'date' ? aDate.getTime() : a.amount;
      const bVal = sortField === 'date' ? bDate.getTime() : b.amount;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [claims, user?.id, searchQuery, statusFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredClaims.length / ITEMS_PER_PAGE);
  const paginatedClaims = filteredClaims.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClaims(paginatedClaims.map((c) => c.id));
    } else {
      setSelectedClaims([]);
    }
  };

  const handleSelectClaim = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedClaims([...selectedClaims, id]);
    } else {
      setSelectedClaims(selectedClaims.filter((c) => c !== id));
    }
  };

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Claims</h1>
          <p className="text-muted-foreground">
            Manage and track all your expense claims
          </p>
        </div>
        <Button asChild variant="gradient" className="gap-2">
          <Link to="/claims/new">
            <Plus className="h-4 w-4" />
            New Claim
          </Link>
        </Button>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search claims..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ClaimStatus | 'all')}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedClaims.length > 0 && (
            <div className="mt-4 flex items-center gap-4 rounded-lg bg-primary/5 p-3">
              <span className="text-sm font-medium">
                {selectedClaims.length} selected
              </span>
              <Button variant="outline" size="sm">
                Bulk Approve
              </Button>
              <Button variant="outline" size="sm" className="text-destructive">
                Bulk Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading claims...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">Failed to load claims</p>
              <Button variant="outline" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claims Table */}
      {!isLoading && !error && (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      paginatedClaims.length > 0 &&
                      selectedClaims.length === paginatedClaims.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Claim ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('amount')}
                    className="gap-1 -ml-3"
                  >
                    Amount
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('date')}
                    className="gap-1 -ml-3"
                  >
                    Date
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI / Compliance</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClaims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>No claims found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClaims.map((claim) => (
                  <TableRow key={claim.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedClaims.includes(claim.id)}
                        onCheckedChange={(checked) =>
                          handleSelectClaim(claim.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/claims/${claim.id}`}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {claim.claimNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <p className="truncate font-medium">{claim.title || 'Untitled Claim'}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {claim.description || '-'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatCategory(claim.category || 'Other')}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₹{claim.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(claim.claimDate || claim.submissionDate || new Date(), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <ClaimStatusBadge status={claim.status} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {claim.aiConfidence > 0 && (
                          <AIConfidenceBadge score={claim.aiConfidence} size="sm" />
                        )}
                        {(claim.complianceScore || 0) > 0 && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-medium w-fit",
                              (claim.complianceScore || 0) >= 80 ? "bg-success/10 text-success border-success/20" :
                              (claim.complianceScore || 0) >= 60 ? "bg-warning/10 text-warning border-warning/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                            )}
                          >
                            {(claim.complianceScore || 0).toFixed(0)}% Policy
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/claims/${claim.id}`} className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {claim.status === 'returned' && (
                            <DropdownMenuItem className="gap-2" asChild>
                              <Link to={`/claims/${claim.id}/edit`}>
                                <Edit className="h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {(claim.status === 'pending_manager' || claim.status === 'returned') && (
                          <DropdownMenuItem 
                            className="gap-2 text-destructive cursor-pointer"
                            onClick={() => handleDeleteClaim(claim.id, claim.claimNumber || claim.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredClaims.length)} of{' '}
            {filteredClaims.length} claims
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="icon"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
