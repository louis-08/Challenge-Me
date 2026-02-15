import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Milestone, ChartData, MilestoneCategory } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface StatsChartProps {
  milestones: Milestone[];
}

export const StatsChart: React.FC<StatsChartProps> = ({ milestones }) => {
  const completedMilestones = milestones.filter(m => m.completed);
  
  if (completedMilestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <p className="text-slate-500 font-medium">Noch keine Meilensteine erreicht.</p>
        <p className="text-slate-400 text-sm mt-1">Zeit, das Leben zu leben!</p>
      </div>
    );
  }

  // Aggregate data by category
  const dataMap: Record<string, number> = {};
  completedMilestones.forEach(m => {
    const cat = m.category;
    dataMap[cat] = (dataMap[cat] || 0) + 1;
  });

  const data: ChartData[] = Object.keys(dataMap).map(cat => ({
    name: cat,
    value: dataMap[cat],
    fill: CATEGORY_COLORS[cat] || '#cbd5e1'
  }));

  return (
    <div className="h-72 w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-800 mb-2">Deine Erfolgsbilanz</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};