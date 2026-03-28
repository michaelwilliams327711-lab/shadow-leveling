import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from "recharts";
import type { Character } from "@workspace/api-client-react";

interface StatRadarProps {
  character: Character;
}

export function StatRadar({ character }: StatRadarProps) {
  const maxStat = Math.max(
    character.strength,
    character.agility,
    character.endurance,
    character.discipline,
    character.intellect,
    1
  );

  // Scale ceiling based on level so early-game stats look small
  // and the polygon grows meaningfully as you progress
  const fullMark = Math.max(character.level * 50, maxStat + 10, 50);

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
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }} 
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
