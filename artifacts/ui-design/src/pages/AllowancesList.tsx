import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Phone,
  Clock,
  TrendingUp,
  Utensils,
  FileText,
} from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { AIConfidenceBadge } from '@/components/claims/AIConfidenceBadge';
import { mockAllowances } from '@/data/mockAllowances';
import { AllowanceStatus, AllowanceType } from '@/types/allowance';

const typeIcons: Record<AllowanceType, React.ElementType> = {
  on_call: Phone,
  shift: Clock,
  work_incentive: TrendingUp,
  food: Utensils,
};

const typeLabels: Record<AllowanceType, string> = {
  on_call: 'On-Call',
  shift: 'Shift',
  work_incentive: 'Work Incentive',
  food: 'Food',
};

const statusColors: Record<AllowanceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  pending_manager: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  payroll_ready: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

const statusLabels: Record<AllowanceStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_manager: 'Pending Manager',
  approved: 'Approved',
  rejected: 'Rejected',
  payroll_ready: 'Payroll Ready',
};

const ITEMS_PER_PAGE = 10;

export default function AllowancesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AllowanceType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AllowanceStatus | 'all'>('all');
  const [selectedAllowances, setSelectedAllowances] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredAllowances = useMemo(() => {
    let result = [...mockAllowances];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.allowanceNumber.toLowerCase().includes(query) ||
          a.submittedBy.name.toLowerCase().includes(query)
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter((a) => a.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }

    return result.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }, [searchQuery, typeFilter, statusFilter]);

  const totalPages = Math.ceil(filteredAllowances.length / ITEMS_PER_PAGE);
  const paginatedAllowances = filteredAllowances.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAllowances(paginatedAllowances.map((a) => a.id));
    } else {
      setSelectedAllowances([]);
    }
  };

  const handleSelectAllowance = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedAllowances([...selectedAllowances, id]);
    } else {
      setSelectedAllowances(selectedAllowances.filter((a) => a !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Allowances</h1>
          <p className="text-muted-foreground">
            Manage and track all your allowance claims
          </p>
        </div>
        <Button asChild variant="gradient" className="gap-2">
          <Link to="/allowances/new">
            <Plus className="h-4 w-4" />
            New Allowance
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
                placeholder="Search allowances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as AllowanceType | 'all')}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="on_call">On-Call</SelectItem>
                  <SelectItem value="shift">Shift</SelectItem>
                  <SelectItem value="work_incentive">Work Incentive</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as AllowanceStatus | 'all')}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_manager">Pending Manager</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="payroll_ready">Payroll Ready</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedAllowances.length > 0 && (
            <div className="mt-4 flex items-center gap-4 rounded-lg bg-primary/5 p-3">
              <span className="text-sm font-medium">
                {selectedAllowances.length} selected
              </span>
              <Button variant="outline" size="sm">
                Bulk Submit
              </Button>
              <Button variant="outline" size="sm">
                Withdraw
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allowances Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      paginatedAllowances.length > 0 &&
                      selectedAllowances.length === paginatedAllowances.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payroll Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAllowances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>No allowances found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAllowances.map((allowance) => {
                  const TypeIcon = typeIcons[allowance.type];
                  return (
                    <TableRow key={allowance.id} className="group">
                      <TableCell>
                        <Checkbox
                          checked={selectedAllowances.includes(allowance.id)}
                          onCheckedChange={(checked) =>
                            handleSelectAllowance(allowance.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/allowances/${allowance.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {allowance.allowanceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{typeLabels[allowance.type]}</span>
                          {allowance.taxable && (
                            <Badge variant="outline" className="text-xs">
                              Taxable
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(allowance.period.startDate, 'MMM dd')} -{' '}
                        {format(allowance.period.endDate, 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{allowance.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{allowance.payrollMonth}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[allowance.status]}>
                          {statusLabels[allowance.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {allowance.aiEligibilityScore && (
                          <AIConfidenceBadge score={allowance.aiEligibilityScore} size="sm" />
                        )}
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
                              <Link
                                to={`/allowances/${allowance.id}`}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-destructive">
                              <Trash2 className="h-4 w-4" />
                              Withdraw
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAllowances.length)} of{' '}
            {filteredAllowances.length} allowances
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
