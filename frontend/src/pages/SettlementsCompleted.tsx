import { useState, useMemo } from 'react';
import { Search, CheckCircle2, Wallet, Download, Eye, Calendar, FileText } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { useClaims } from '@/hooks/useClaims';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function SettlementsCompleted() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: allClaims = [], isLoading } = useClaims();

  // Filter claims that are settled
  const settledClaims = useMemo(() => {
    return allClaims.filter((claim) => claim.status === 'settled');
  }, [allClaims]);

  const filteredClaims = useMemo(() => {
    return settledClaims.filter((claim) => {
      const matchesSearch =
        claim.claimNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.paymentReference?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [settledClaims, searchQuery]);

  const totalSettledAmount = useMemo(() => {
    return settledClaims.reduce((sum, claim) => sum + (claim.amount || 0), 0);
  }, [settledClaims]);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const handleViewDetails = (claim: any) => {
    setSelectedClaim(claim);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settled Claims</h1>
          <p className="text-muted-foreground">
            View all settled expense claims and payment details
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Settled</p>
                <p className="text-2xl font-bold">{settledClaims.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount Settled</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSettledAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by claim number, employee, or transaction ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Settled Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Settled Claims ({filteredClaims.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No settled claims found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Settlement Date</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-mono text-sm">
                      <Link 
                        to={`/claims/${claim.id}`}
                        className="text-primary hover:underline"
                      >
                        {claim.claimNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {claim.employeeName}
                    </TableCell>
                    <TableCell>
                      {typeof claim.category === 'string'
                        ? claim.category
                        : claim.category?.name || '-'}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(claim.amount)}
                    </TableCell>
                    <TableCell>
                      {claim.settledDate
                        ? format(new Date(claim.settledDate), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {claim.paymentReference || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {claim.paymentMethod || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/claims/${claim.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(claim)}
                        >
                          Details
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

      {/* Settlement Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settlement Details</DialogTitle>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Claim Number</p>
                  <p className="font-medium">{selectedClaim.claimNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedClaim.employeeName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-lg">{formatCurrency(selectedClaim.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{selectedClaim.category}</p>
                </div>
              </div>
              
              <hr className="my-4" />
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Payment Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-mono font-medium">{selectedClaim.paymentReference || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {selectedClaim.paymentMethod || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Settlement Date</p>
                    <p className="font-medium">
                      {selectedClaim.settledDate
                        ? format(new Date(selectedClaim.settledDate), 'MMMM d, yyyy')
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className="bg-green-500 text-white">Settled</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
