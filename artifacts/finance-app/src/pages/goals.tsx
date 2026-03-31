import { useState } from "react";
import { 
  useListGoalVaults, 
  getListGoalVaultsQueryKey,
  useGetGoalProjection,
  getGetGoalProjectionQueryKey,
  useConsolidateSurplus
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ShieldCheck, ArrowRightLeft, Target } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Goals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: vaults, isLoading: isLoadingVaults } = useListGoalVaults(
    { query: { enabled: true, queryKey: getListGoalVaultsQueryKey() } }
  );

  const { data: projection, isLoading: isLoadingProjection } = useGetGoalProjection(
    { month: currentMonth },
    { query: { enabled: true, queryKey: getGetGoalProjectionQueryKey({ month: currentMonth }) } }
  );

  const consolidate = useConsolidateSurplus();

  const handleConsolidate = () => {
    consolidate.mutate({ data: { month: currentMonth } }, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ 
            title: "Surplus Consolidated", 
            description: `Moved ${formatCurrency(res.amountAdded)} into Wealth Shield. New Balance: ${formatCurrency(res.newBalance)}` 
          });
          queryClient.invalidateQueries({ queryKey: getListGoalVaultsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetGoalProjectionQueryKey({ month: currentMonth }) });
        } else {
          toast({ title: "No Surplus", description: "There is no surplus to consolidate for this month.", variant: "destructive" });
        }
      },
      onError: (err) => {
        toast({ title: "Error", description: String(err), variant: "destructive" });
      }
    });
  };

  const emergencyVault = vaults?.find(v => v.name.includes("Emergency Fund"));
  const otherVaults = vaults?.filter(v => !v.name.includes("Emergency Fund")) || [];

  const efTarget = emergencyVault ? Number(emergencyVault.targetAmount) : 0;
  const efCurrent = emergencyVault ? Number(emergencyVault.currentBalance) : 0;
  const efProgress = efTarget > 0 ? (efCurrent / efTarget) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Goal Vault</h1>
          <p className="text-muted-foreground text-sm mt-1">Automate surplus into financial security.</p>
        </div>

        <Button 
          onClick={handleConsolidate}
          disabled={consolidate.isPending}
          className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" /> 
          {consolidate.isPending ? "Consolidating..." : "Consolidate Surplus"}
        </Button>
      </div>

      <Card className="bg-card/80 backdrop-blur border-primary/30 shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Wealth Shield</CardTitle>
            <CardDescription>Primary Emergency Fund</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoadingVaults ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : emergencyVault ? (
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-4xl font-bold font-mono tracking-tight text-foreground">
                    {formatCurrency(efCurrent)}
                  </div>
                  <div className="text-sm font-mono text-muted-foreground mt-1 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Target: {formatCurrency(efTarget)}
                  </div>
                </div>
                <div className="text-2xl font-mono font-bold text-primary">
                  {efProgress.toFixed(1)}%
                </div>
              </div>
              <Progress 
                value={Math.min(efProgress, 100)} 
                className="h-4 bg-secondary" 
                indicatorClassName="bg-primary"
              />
            </div>
          ) : (
             <div className="text-center py-6 text-muted-foreground font-mono text-sm">
                No Emergency Fund configured.
             </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">12-Month Projection</CardTitle>
            <CardDescription>Estimated trajectory based on average surplus</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            {isLoadingProjection ? (
              <Skeleton className="w-full h-full" />
            ) : projection && projection.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--font-mono)" }}
                    tickFormatter={(val) => `\u20B9${val/1000}k`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontFamily: "var(--font-mono)", fontSize: "12px" }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <ReferenceLine y={Number(projection[0]?.targetAmount || 0)} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ position: 'top', value: 'Target', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: "var(--font-mono)" }} />
                  <Line 
                    type="monotone" 
                    dataKey="projectedBalance" 
                    name="Projected Balance" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed rounded-md border-border/50">
                Not enough data for projection
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Other Vaults</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingVaults ? (
               <div className="space-y-4">
                 {[1,2].map(i => (
                   <div key={i} className="space-y-2">
                     <Skeleton className="h-5 w-24" />
                     <Skeleton className="h-2 w-full" />
                   </div>
                 ))}
               </div>
            ) : otherVaults.length > 0 ? (
              <div className="space-y-6">
                {otherVaults.map(vault => {
                  const target = Number(vault.targetAmount);
                  const current = Number(vault.currentBalance);
                  const prog = target > 0 ? (current / target) * 100 : 0;

                  return (
                    <div key={vault.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{vault.name}</span>
                        <span className="font-mono text-xs font-bold">{formatCurrency(current)}</span>
                      </div>
                      <Progress value={Math.min(prog, 100)} className="h-2 bg-secondary" />
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>{prog.toFixed(1)}%</span>
                        <span>{formatCurrency(target)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                No secondary vaults created.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
