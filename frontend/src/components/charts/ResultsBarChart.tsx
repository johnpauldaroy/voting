import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PositionResult } from "@/api/types";

interface ResultsBarChartProps {
  position: PositionResult;
}

const COLORS = ["#1e4db7", "#5b7fd0", "#8ca7de", "#31497d", "#7592ce", "#9fb5e3"];

export function ResultsBarChart({ position }: ResultsBarChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={position.candidates} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e7ecf7" strokeDasharray="3 3" />
          <XAxis dataKey="name" interval={0} angle={-12} textAnchor="end" height={68} stroke="#777e89" />
          <YAxis allowDecimals={false} stroke="#777e89" />
          <Tooltip />
          <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
            {position.candidates.map((candidate, index) => (
              <Cell key={candidate.id} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
