import { useState } from 'react';
import { Search, CheckCircle2, Clock, Wallet, Download, Filter } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface Settlement {
  id: string;
  claimNumber: string;
  employeeName: string;
  amount: number;
  category: string;
  approvedDate: Date;
  status: 'pending' | 'processing' | 'settled';
  paymentMethod?: string;
  paymentReference?: string;
  settledDate?: Date;
}

const mockSettlements: Settlement[] = [
  {
    id: '1',
    claimNumber: 'EXP-2024-001',
    employeeName: 'John Doe',
    amount: 1250.00,
    category: 'Travel',
    approvedDate: new Date('2024-01-15'),
    status: 'pending',
  },
  {
    id: '2',
    claimNumber: 'EXP-2024-002',
    employeeName: 'Jane Smith',
    amount: 450.00,
    category: 'Meals',
    approvedDate: new Date('2024-01-14'),
    status: 'pending',
  },
  {
    id: '3',
    claimNumber: 'EXP-2024-003',
    employeeName: 'Bob Wilson',
    amount: 2500.00,
    category: 'Equipment',
    approvedDate: new Date('2024-01-10'),
    status: 'processing',
  },
  {
    id: '4',
    claimNumber: 'EXP-2023-098',
    employeeName: 'Alice Johnson',
    amount: 890.00,
    category: 'Travel',
    approvedDate: new Date('2024-01-05'),
    status: 'settled',
    paymentMethod: 'NEFT',
    paymentReference: 'NEFT20240108001',
    settledDate: new Date('2024-01-08'),
  },
];

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  settled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

export default function Settlements() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const filteredSettlements = mockSettlements.filter((settlement) => {
    const matchesSearch =
      settlement.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      settlement.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || settlement.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingSettlements = mockSettlements.filter((s) => s.status === 'pending');
  const totalPending = pendingSettlements.reduce((sum, s) => sum + s.amount, 0);
  const totalSettled = mockSettlements
    .filter((s) => s.status === 'settled')
    .reduce((sum, s) => sum + s.amount, 0);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pendingSettlements.map((s) => s.id));
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

  const handleBulkSettle = () => {
    if (selectedIds.length > 0) {
      setIsSettleDialogOpen(true);
    }
  };

  const confirmSettle = () => {
    // In real app, this would call an API
    setIsSettleDialogOpen(false);
    setSelectedIds([]);
    setPaymentMethod('');
    setPaymentReference('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settlement Management</h1>
          <p className="text-muted-foreground">
            Process payments for approved expense claims
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
            onClick={handleBulkSettle}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Settle Selected ({selectedIds.length})
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
                <p className="text-2xl font-bold">${totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Settled</p>
                <p className="text-2xl font-bold">${totalSettled.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by claim number or employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Settlements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Payment Queue ({filteredSettlements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      selectedIds.length === pendingSettlements.length &&
                      pendingSettlements.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Claim #</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Approved Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSettlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(settlement.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(settlement.id, checked as boolean)
                      }
                      disabled={settlement.status !== 'pending'}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {settlement.claimNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    {settlement.employeeName}
                  </TableCell>
                  <TableCell>{settlement.category}</TableCell>
                  <TableCell className="font-semibold">
                    ${settlement.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {format(settlement.approvedDate, 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusStyles[settlement.status]}
                    >
                      {settlement.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {settlement.status === 'settled' ? (
                      <div className="text-sm">
                        <p className="font-medium">{settlement.paymentMethod}</p>
                        <p className="text-muted-foreground text-xs">
                          {settlement.paymentReference}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Settlement Dialog */}
      <Dialog open={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Settlement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You are about to settle {selectedIds.length} claim(s) totaling{' '}
              <span className="font-semibold text-foreground">
                $
                {mockSettlements
                  .filter((s) => selectedIds.includes(s.id))
                  .reduce((sum, s) => sum + s.amount, 0)
                  .toLocaleString()}
              </span>
            </p>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Reference</Label>
              <Input
                placeholder="Enter payment reference number"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmSettle}
              disabled={!paymentMethod || !paymentReference}
            >
              Confirm Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
