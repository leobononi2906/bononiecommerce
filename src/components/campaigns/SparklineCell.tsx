import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface Props {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export default function SparklineCell({ data, color, width = 60, height = 20 }: Props) {
  if (!data.length) return <span className="text-txt-hint text-xs">–</span>

  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0
  const lineColor = color || (trend >= 0 ? 'var(--green)' : 'var(--red)')
  const chartData = data.map((v, i) => ({ i, v }))

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={lineColor} dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
