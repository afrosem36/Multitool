import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/**
 * LiveGraph — real-time speed history area chart.
 *
 * @param {object} props
 * @param {Array<{ t: string, speed: number }>} props.data
 * @param {number} [props.height]
 */
export default function LiveGraph({ data, height = 120 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="t" tick={false} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#12121a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: '#a5b4fc' }}
          formatter={(v) => [`${v} Mbps`, 'Speed']}
          labelFormatter={() => ''}
        />
        <Area
          type="monotone"
          dataKey="speed"
          stroke="#6366f1"
          fill="url(#liveGrad)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
