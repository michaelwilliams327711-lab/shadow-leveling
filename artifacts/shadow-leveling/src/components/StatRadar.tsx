import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from "recharts";
import type { Character } from "@workspace/api-client-react";

interface StatRadarProps {
  character: Character;
}

const STAT_COLORS: Record<string, string> = {
  STR: "#f87171",
  AGI: "#facc15",
  END: "#4ade80",
  INT: "#60a5fa",
  DIS: "#c084fc",
};

function ColoredTick({ x, y, payload, textAnchor }: { x: number; y: number; payload: { value: string }; textAnchor: string }) {
  const color = STAT_COLORS[payload.value] ?? "hsl(var(--foreground))";
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={color}
      fontSize={12}
      fontFamily="Rajdhani, sans-serif"
      fontWeight={700}
    >
      {payload.value}
    </text>
  );
}

export function StatRadar({ character }: StatRadarProps) {
  const fullMark = 110_000;

  const data = [
    { subject: "STR", A: character.strength, fullMark },
    { subject: "AGI", A: character.agility, fullMark },
    { subject: "END", A: character.endurance, fullMark },
    { subject: "DIS", A: character.discipline, fullMark },
    { subject: "INT", A: character.intellect, fullMark },
  ];

  return (
    <div className="h-[250px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="hsl(var(--muted-foreground)/0.3)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={(props) => <ColoredTick {...props} />}
          />
          <PolarRadiusAxis angle={30} domain={[0, fullMark]} tick={false} axisLine={false} />
          <Radar
            name="Stats"
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
