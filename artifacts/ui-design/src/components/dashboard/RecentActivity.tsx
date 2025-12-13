import { cn } from "@/lib/utils";
import { Check, Clock, X, FileText } from "lucide-react";

type ClaimStatus = "pending" | "approved" | "rejected";

interface ActivityItem {
  id: string;
  title: string;
  amount: string;
  date: string;
  status: ClaimStatus;
}

const activities: ActivityItem[] = [
  {
    id: "1",
    title: "Flight Ticket - NYC Conference",
    amount: "$450.00",
    date: "Today, 2:30 PM",
    status: "approved",
  },
  {
    id: "2",
    title: "Hotel Stay - 3 Nights",
    amount: "$890.00",
    date: "Yesterday, 4:15 PM",
    status: "pending",
  },
  {
    id: "3",
    title: "Client Dinner",
    amount: "$125.50",
    date: "Dec 8, 2024",
    status: "approved",
  },
  {
    id: "4",
    title: "Software Subscription",
    amount: "$99.00",
    date: "Dec 7, 2024",
    status: "rejected",
  },
  {
    id: "5",
    title: "Office Equipment",
    amount: "$234.00",
    date: "Dec 5, 2024",
    status: "approved",
  },
];

const statusConfig = {
  pending: {
    icon: Clock,
    label: "Pending",
    className: "bg-warning/10 text-warning border-warning/20",
    iconClassName: "text-warning",
  },
  approved: {
    icon: Check,
    label: "Approved",
    className: "bg-success/10 text-success border-success/20",
    iconClassName: "text-success",
  },
  rejected: {
    icon: X,
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    iconClassName: "text-destructive",
  },
};

function StatusBadge({ status }: { status: ClaimStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        config.className
      )}
    >
      <Icon className={cn("h-3 w-3", config.iconClassName)} />
      {config.label}
    </span>
  );
}

export function RecentActivity() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-card opacity-0 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Recent Activity</h3>
        <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
          View all
        </button>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-6">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className={cn(
                "relative flex gap-4 opacity-0 animate-slide-in-right"
              )}
              style={{ animationDelay: `${600 + index * 100}ms` }}
            >
              {/* Timeline dot */}
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <FileText className="h-4 w-4 text-secondary-foreground" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {activity.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {activity.date}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="font-semibold text-foreground">
                      {activity.amount}
                    </p>
                    <StatusBadge status={activity.status} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
