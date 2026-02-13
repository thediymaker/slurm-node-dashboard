import { Button } from "@/components/ui/button";
import { Bot, MessageSquare } from "lucide-react";

interface EmptyStateProps {
    setInput: (value: string) => void;
}

export function EmptyState({ setInput }: EmptyStateProps) {
    const starters = [
        {
            heading: "Node Details",
            message: 'Show me details for node "sc020"',
        },
        {
            heading: "Job Details",
            message: 'Show me details for job "12345"',
        },
        {
            heading: "Partition Info",
            message: 'Show me details for the "debug" partition',
        },
        {
            heading: "Reservation Info",
            message: 'Show me details for the "maintenance" reservation',
        },
        {
            heading: "QoS Info",
            message: 'Show me details for the "normal" QoS',
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl shadow-sm mb-6">
                <Bot className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight mb-2">How can I help you today?</h3>
            <p className="text-muted-foreground mb-8 max-w-sm text-sm">
                I can help you check job status, node details, or answer Slurm-related questions used on this cluster.
            </p>
            <div className="grid gap-3 w-full max-w-sm">
                {starters.map((starter, i) => (
                    <Button
                        key={i}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 text-left border-muted hover:border-primary/20 hover:bg-muted/50 transition-all rounded-lg shadow-sm"
                        onClick={() => setInput(starter.message)}
                    >
                        <div className="flex flex-col items-start gap-1">
                            <span className="font-medium text-[10px] text-primary/70 uppercase tracking-wider">
                                {starter.heading}
                            </span>
                            <span className="text-sm font-normal text-foreground/90">{starter.message}</span>
                        </div>
                    </Button>
                ))}
            </div>
        </div>
    );
}
