import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from "recharts";
import type { Character } from "@workspace/api-client-react";
import { STAT_META } from "@workspace/shared";

interface StatRadarProps {
  character: Character;
}

function ColoredTick({ x, y, payload, textAnchor }: { x: number; y: number; payload: { value: string }; textAnchor: string }) {
  const entry = Object.values(STAT_META).find((m) => m.abbr === payload.value);
  const color = entry?.color ?? "hsl(var(--foreground))";
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
    { subject: STAT_META.strength.abbr,   A: character.strength,   fullMark },
    { subject: STAT_META.agility.abbr,    A: character.agility,    fullMark },
    { subject: STAT_META.endurance.abbr,  A: character.endurance,  fullMark },
    { subject: STAT_META.discipline.abbr, A: character.discipline, fullMark },
    { subject: STAT_META.intellect.abbr,  A: character.intellect,  fullMark },
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
