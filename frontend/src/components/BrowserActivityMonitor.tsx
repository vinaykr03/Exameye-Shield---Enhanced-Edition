import { Eye, ExternalLink, Copy, Focus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BrowserActivityMonitorProps {
  tabSwitches: number;
  copyPasteEvents: number;
  windowFocus: boolean;
}

export const BrowserActivityMonitor = ({ 
  tabSwitches, 
  copyPasteEvents, 
  windowFocus 
}: BrowserActivityMonitorProps) => {
  // Log prop changes for debugging
  console.log('🔍 BrowserActivityMonitor render:', { tabSwitches, copyPasteEvents, windowFocus });
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Browser Activity Monitor</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Tab Switches</span>
            </div>
            <Badge variant={tabSwitches > 0 ? "destructive" : "secondary"} className="min-w-[40px] justify-center">
              {tabSwitches}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Copy/Paste Events</span>
            </div>
            <Badge variant={copyPasteEvents > 0 ? "destructive" : "secondary"} className="min-w-[40px] justify-center">
              {copyPasteEvents}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Focus className={`w-4 h-4 ${windowFocus ? 'text-green-500' : 'text-red-500'}`} />
              <span className="text-sm">Window Focus</span>
            </div>
            <Badge 
              variant={windowFocus ? "default" : "destructive"}
              className={`min-w-[70px] justify-center ${windowFocus ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              {windowFocus ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
