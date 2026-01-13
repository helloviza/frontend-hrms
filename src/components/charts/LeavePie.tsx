import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

export type LeaveSlice = { name: string; value: number };

// make data optional with a default
function LeavePieBase({ data = [] }: { data?: LeaveSlice[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius="80%">
            {data.map((_, i) => (
              <Cell key={i} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LeavePieBase;
export const LeavePie = LeavePieBase;
export { LeavePieBase };
