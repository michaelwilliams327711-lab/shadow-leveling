import { memo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  PolarRadiusAxis,
} from "recharts";
import type { Character } from "@workspace/api-client-react";

interface StatRadarProps {
  character: Character;
}

const DOMAIN_POINTS = [
  { subject: "STR", key: "strength"   as const, color: "#f87171" },
  { subject: "SPI", key: "spirit"     as const, color: "#f472b6" },
  { subject: "END", key: "endurance"  as const, color: "#4ade80" },
  { subject: "INT", key: "intellect"  as const, color: "#60a5fa" },
  { subject: "DIS", key: "discipline" as const, color: "#c084fc" },
];

function ColoredTick({
  x,
  y,
  payload,
  textAnchor,
}: {
  x: number;
  y: number;
  payload: { value: string };
  textAnchor: string;
}) {
  const entry = DOMAIN_POINTS.find((p) => p.subject === payload.value);
  const color = entry?.color ?? "#e2e8f0";
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={color}
      fontSize={11}
      fontFamily="Rajdhani, sans-serif"
      fontWeight={700}
      style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
    >
      {payload.value}
    </text>
  );
}

function StatRadarBase({ character }: StatRadarProps) {
  const fullMark = 110_000;

  const data = DOMAIN_POINTS.map((p) => ({
    subject: p.subject,
    A: (character as Record<string, unknown>)[p.key] as number ?? 0,
    fullMark,
  }));

  return (
    <div
      className="h-[260px] w-full mt-4 rounded-xl"
      style={{
        background: "linear-gradient(135deg, #18181b 0%, #1c1027 100%)",
        border: "1px solid rgba(168,85,247,0.15)",
        boxShadow: "inset 0 0 30px rgba(88,28,135,0.15)",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="52%" outerRadius="68%" data={data}>
          <defs>
            <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="perimeter-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <PolarGrid
            stroke="rgba(168,85,247,0.2)"
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={(props) => <ColoredTick {...props} />}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, fullMark]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Attributes"
            dataKey="A"
            stroke="#a855f7"
            strokeWidth={2.5}
            fill="#a855f7"
            fillOpacity={0.25}
            style={{ filter: "drop-shadow(0 0 8px rgba(168,85,247,0.9))" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const StatRadar = memo(StatRadarBase);
