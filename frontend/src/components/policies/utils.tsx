// Utility functions for Policies

import { Badge } from '@/components/ui/badge';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    Loader2,
    FileCheck,
} from 'lucide-react';

export function getStatusBadge(status: string) {
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

export function formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
