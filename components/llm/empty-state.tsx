import { Sparkles } from "lucide-react";

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
            message: "List current reservations",
        },
        {
            heading: "QoS Info",
            message: 'Show me details for the "normal" QoS',
        },
    ];

    return (
        <div className="flex h-full flex-col justify-end gap-4 px-4 pb-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4" style={{ color: "hsl(var(--chart-1))" }} />
                    How can I help?
                </div>
                <p className="text-sm text-muted-foreground">
                    I can help you check job status, node details, or answer Slurm-related questions used on this cluster.
                </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {starters.map((starter) => (
                    <button
                        key={starter.heading}
                        type="button"
                        title={starter.heading}
                        className="rounded-full border bg-card px-3 py-1.5 text-left text-xs text-foreground/90 transition-colors hover:border-ring/40 hover:bg-muted/60"
                        onClick={() => setInput(starter.message)}
                    >
                        {starter.message}
                    </button>
                ))}
            </div>
        </div>
    );
}
