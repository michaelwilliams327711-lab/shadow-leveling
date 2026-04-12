import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from "recharts";
import type { Character } from "@workspace/api-client-react";

interface StatRadarProps {
  character: Character;
}

const DOMAIN_POINTS = [
  { subject: "STR", key: "strength"   as const, color: "#f87171" },
  { subject: "SPI", key: "agility"    as const, color: "#f472b6" },
  { subject: "END", key: "endurance"  as const, color: "#4ade80" },
  { subject: "DIS", key: "discipline" as const, color: "#c084fc" },
  { subject: "INT", key: "intellect"  as const, color: "#818cf8" },
];

function ColoredTick({ x, y, payload, textAnchor }: { x: number; y: number; payload: { value: string }; textAnchor: string }) {
  const entry = DOMAIN_POINTS.find((p) => p.subject === payload.value);
  const color = entry?.color ?? "hsl(var(--foreground))";
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={color}
      fontSize={11}
      fontFamily="Rajdhani, sans-serif"
      fontWeight={700}
    >
      {payload.value}
    </text>
  );
}

export function StatRadar({ character }: StatRadarProps) {
  const fullMark = 110_000;

  const data = DOMAIN_POINTS.map((p) => ({
    subject: p.subject,
    A: character[p.key],
    fullMark,
  }));

  return (
    <div className="h-[250px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="hsl(var(--muted-foreground)/0.3)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={(props) => <ColoredTick {...props} />}
          />
          <PolarRadiusAxis angle={90} domain={[0, fullMark]} tick={false} axisLine={false} />
          <Radar
            name="Domains"
            dataKey="A"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="hsl(var(--primary))"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
