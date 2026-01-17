import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ReasoningLog } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BrainCircuit, Activity, LineChart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentLogsProps {
  logs: ReasoningLog[];
}

export function AgentLogs({ logs }: AgentLogsProps) {
  // Sort logs by newest first
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

  const getAgentIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'orchestrator': return <BrainCircuit className="w-3 h-3" />;
      case 'pricing': return <Activity className="w-3 h-3" />;
      case 'forecast': return <LineChart className="w-3 h-3" />;
      default: return <BrainCircuit className="w-3 h-3" />;
    }
  };

  const getAgentColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'orchestrator': return "bg-indigo-500/10 text-indigo-500 border-indigo-200 dark:border-indigo-800";
      case 'pricing': return "bg-emerald-500/10 text-emerald-500 border-emerald-200 dark:border-emerald-800";
      case 'forecast': return "bg-blue-500/10 text-blue-500 border-blue-200 dark:border-blue-800";
      default: return "bg-slate-500/10 text-slate-500 border-slate-200";
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" />
          Agent Reasoning Trace
        </h3>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {sortedLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 italic">
                Waiting for agent activity...
              </div>
            ) : (
              sortedLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3 group"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-[1px] h-full bg-border group-last:bg-transparent" />
                    <div className="w-2 h-2 rounded-full bg-border mt-2 absolute" />
                  </div>
                  
                  <div className="flex-1 pb-4">
                    <div className={cn(
                      "rounded-lg p-3 border text-sm transition-all hover:shadow-md",
                      getAgentColor(log.agentName)
                    )}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 font-mono font-bold uppercase text-xs">
                          {getAgentIcon(log.agentName)}
                          {log.agentName}
                        </div>
                        <span className="text-[10px] opacity-70 font-mono">
                          {log.timestamp && format(new Date(log.timestamp), 'HH:mm:ss')}
                        </span>
                      </div>
                      
                      <div className="font-semibold mb-1">{log.decision}</div>
                      <div className="opacity-90 leading-relaxed text-xs">
                        {log.reasoning}
                      </div>
                      
                      {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 font-mono text-[10px] opacity-75 overflow-x-auto">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
