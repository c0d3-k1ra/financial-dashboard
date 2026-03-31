export function computeGoalIntelligence(goal: {
  id: number;
  currentAmount: string | null;
  targetAmount: string | null;
  targetDate: string | null;
}, allocations: { amount: string; allocatedAt: Date }[]) {
  const current = Number(goal.currentAmount ?? 0);
  const target = Number(goal.targetAmount ?? 0);

  let velocity = 0;
  if (allocations.length > 0) {
    const totalAllocated = allocations.reduce((s, a) => s + Number(a.amount), 0);
    const firstDate = new Date(Math.min(...allocations.map(a => new Date(a.allocatedAt).getTime())));
    const monthsActive = Math.max(1, (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    velocity = totalAllocated / monthsActive;
  }

  let statusIndicator = "On Track";
  let projectedFinishDate: string | null = null;

  if (target > 0 && current >= target) {
    statusIndicator = "Achieved";
  } else if (target > 0 && current < target) {
    const remaining = target - current;
    if (velocity > 0) {
      const monthsToFinish = remaining / velocity;
      const projected = new Date();
      projected.setMonth(projected.getMonth() + Math.ceil(monthsToFinish));
      projectedFinishDate = `${projected.getFullYear()}-${String(projected.getMonth() + 1).padStart(2, "0")}`;

      if (goal.targetDate) {
        const targetD = new Date(goal.targetDate);
        if (projected > targetD) {
          const diff = (projected.getTime() - targetD.getTime()) / (1000 * 60 * 60 * 24 * 30);
          statusIndicator = diff > 3 ? "Behind" : "At Risk";
        } else {
          statusIndicator = "On Track";
        }
      } else {
        statusIndicator = "On Track";
      }
    } else {
      if (goal.targetDate) {
        const targetD = new Date(goal.targetDate);
        statusIndicator = targetD < new Date() ? "Behind" : "At Risk";
      } else {
        statusIndicator = "Not Started";
      }
    }
  }

  return { velocity: Math.round(velocity * 100) / 100, statusIndicator, projectedFinishDate };
}
