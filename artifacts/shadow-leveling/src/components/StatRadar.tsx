import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from "recharts";
import type { Character } from "@workspace/api-client-react";

interface StatRadarProps {
  character: Character;
}

export function StatRadar({ character }: StatRadarProps) {
  const data = [
    { subject: "STR", A: character.strength, fullMark: Math.max(10, character.strength + 5) },
    { subject: "AGI", A: character.agility, fullMark: Math.max(10, character.agility + 5) },
    { subject: "END", A: character.endurance, fullMark: Math.max(10, character.endurance + 5) },
    { subject: "DIS", A: character.discipline, fullMark: Math.max(10, character.discipline + 5) },
    { subject: "INT", A: character.intellect, fullMark: Math.max(10, character.intellect + 5) },
  ];

  return (
    <div className="h-[250px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="hsl(var(--muted-foreground)/0.3)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} tick={false} axisLine={false} />
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
