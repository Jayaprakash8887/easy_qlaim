import { useState, useMemo } from 'react';
import { Search, CheckCircle2, Clock, Wallet, Download, Eye, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { useClaims } from '@/hooks/useClaims';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Claim } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export default function SettlementsPending() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const [settlementData, setSettlementData] = useState({
    transactionId: '',
    settlementDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: allClaims = [], isLoading, refetch } = useClaims();

  // Filter claims that are finance approved (ready for settlement)
  const pendingSettlements = useMemo(() => {
    return allClaims.filter((claim) => claim.status === 'finance_approved');
  }, [allClaims]);

  const filteredClaims = useMemo(() => {
    return pendingSettlements.filter((claim) => {
      const matchesSearch =
        claim.claimNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [pendingSettlements, searchQuery]);

  const totalPendingAmount = useMemo(() => {
    return pendingSettlements.reduce((sum, claim) => sum + (claim.amount || 0), 0);
  }, [pendingSettlements]);

  const selectedAmount = useMemo(() => {
    return filteredClaims
      .filter((claim) => selectedIds.includes(claim.id))
      .reduce((sum, claim) => sum + (claim.amount || 0), 0);
  }, [filteredClaims, selectedIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredClaims.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const handleSettleClick = () => {
    if (selectedIds.length > 0) {
      setIsSettleDialogOpen(true);
    }
  };

  const handleSettleSingle = (claimId: string) => {
    setSelectedIds([claimId]);
    setIsSettleDialogOpen(true);
  };

  const confirmSettle = async () => {
    if (!settlementData.transactionId || !settlementData.settlementDate || !settlementData.paymentMethod) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Settle each selected claim
      for (const claimId of selectedIds) {
        const claim = filteredClaims.find((c) => c.id === claimId);
        if (!claim) continue;

        const response = await fetch(`${API_BASE_URL}/claims/${claimId}/settle?tenant_id=${tenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim_id: claimId,
            payment_reference: settlementData.transactionId,
            payment_method: settlementData.paymentMethod.toUpperCase(),
            amount_paid: claim.amount,
            settlement_notes: settlementData.notes || `Settled on ${settlementData.settlementDate}`,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to settle claim');
        }
      }

      toast.success(`Successfully settled ${selectedIds.length} claim(s)`);
      setIsSettleDialogOpen(false);
      setSelectedIds([]);
      setSettlementData({
        transactionId: '',
        settlementDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: '',
        notes: '',
      });
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to settle claims');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
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
          <h1 className="text-2xl font-bold text-foreground">Finance Approved Claims</h1>
          <p className="text-muted-foreground">
            Claims approved by finance, ready for settlement
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.length === 0}
            onClick={handleSettleClick}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Settle Selected ({selectedIds.length})
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Settlement</p>
                <p className="text-2xl font-bold">{pendingSettlements.length}</p>
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
                <p className="text-sm text-muted-foreground">Amount Pending</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPendingAmount)}</p>
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
              placeholder="Search by claim number or employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Pending Settlement ({filteredClaims.length})
            {selectedIds.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                - Selected: {formatCurrency(selectedAmount)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>No claims pending settlement</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedIds.length === filteredClaims.length &&
                        filteredClaims.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Claim #</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Approved Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(claim.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOne(claim.id, checked as boolean)
                        }
                      />
                    </TableCell>
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
                      {claim.submissionDate
                        ? format(new Date(claim.submissionDate), 'MMM d, yyyy')
                        : '-'}
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
                          size="sm"
                          onClick={() => handleSettleSingle(claim.id)}
                        >
                          Settle
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

      {/* Settlement Dialog */}
      <Dialog open={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Settlement</DialogTitle>
            <DialogDescription>
              You are about to settle {selectedIds.length} claim(s) totaling{' '}
              <span className="font-semibold text-foreground">
                {formatCurrency(selectedAmount)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="transactionId">Transaction ID *</Label>
              <Input
                id="transactionId"
                placeholder="Enter transaction/reference ID"
                value={settlementData.transactionId}
                onChange={(e) =>
                  setSettlementData({ ...settlementData, transactionId: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settlementDate">Settlement Date *</Label>
              <Input
                id="settlementDate"
                type="date"
                value={settlementData.settlementDate}
                onChange={(e) =>
                  setSettlementData({ ...settlementData, settlementDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select
                value={settlementData.paymentMethod}
                onValueChange={(value) =>
                  setSettlementData({ ...settlementData, paymentMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="imps">IMPS</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Add any additional notes"
                value={settlementData.notes}
                onChange={(e) =>
                  setSettlementData({ ...settlementData, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmSettle}
              disabled={
                !settlementData.transactionId ||
                !settlementData.settlementDate ||
                !settlementData.paymentMethod ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Processing...' : 'Confirm Settlement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
