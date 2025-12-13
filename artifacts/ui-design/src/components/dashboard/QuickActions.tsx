import { Plus, FileText, Upload, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl bg-card p-6 shadow-card opacity-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <h3 className="mb-4 font-semibold text-foreground">Quick Actions</h3>
      
      <div className="space-y-3">
        <Button 
          variant="gradient" 
          size="lg" 
          className="w-full justify-start gap-3"
          onClick={() => navigate('/claims/new')}
        >
          <Plus className="h-5 w-5" />
          New Claim
        </Button>
        
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3"
          onClick={() => navigate('/claims/new')}
        >
          <Upload className="h-4 w-4" />
          Upload Receipt
        </Button>
        
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3"
          onClick={() => navigate('/claims')}
        >
          <FileText className="h-4 w-4" />
          View All Claims
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => navigate('/claims')}
        >
          <History className="h-4 w-4" />
          Claim History
        </Button>
      </div>
    </div>
  );
}
