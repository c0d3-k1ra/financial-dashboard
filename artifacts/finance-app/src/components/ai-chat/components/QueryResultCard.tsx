import type { ChatMessage } from "../types";

interface QueryResultCardProps {
  msg: ChatMessage;
}

export function QueryResultCard({ msg }: QueryResultCardProps) {
  const qd = msg.queryData;
  if (!qd) return null;

  return (
    <div className="glass-2 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{qd.title}</h4>
          {qd.total && (
            <span className="text-lg font-bold tracking-tight">{qd.total}</span>
          )}
        </div>

        {qd.items.length > 0 && (
          <div className="space-y-1">
            {qd.items.map((item, i) => (
              <div
                key={i}
                className={`flex items-center justify-between py-2 px-2 rounded-lg ${
                  i % 2 === 0 ? "bg-[rgba(var(--glass-overlay-rgb),0.03)]" : ""
                }`}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {item.sublabel && (
                    <p className="text-[11px] text-muted-foreground truncate">{item.sublabel}</p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {qd.summary && (
          <div className="pt-2 border-t border-[var(--divider-color)]">
            <p className="text-xs text-muted-foreground">{qd.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
