import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VolatilitySummary } from '@/lib/api';
import { BarChart3, Activity, AlertCircle } from 'lucide-react';

interface RelativeVolumeProps {
  data: VolatilitySummary['relative_volume'] | undefined;
  isLoading?: boolean;
}

export function RelativeVolume({ data, isLoading }: RelativeVolumeProps) {
  if (isLoading || !data) {
    return (
      <Card className="glass h-full animate-pulse">
        <CardContent className="p-6 h-[200px] flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data.available) {
    return (
      <Card className="glass h-full border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-5 w-5" />
            Relative Volume
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[140px] text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Volume data not available for this asset class</p>
        </CardContent>
      </Card>
    );
  }

  const { current_volume, avg_volume, relative_volume, classification, recent_volumes } = data;

  let colorClass = 'text-primary';
  let barColorClass = 'bg-primary';
  if (relative_volume > 1.5) {
    colorClass = 'text-success';
    barColorClass = 'bg-success';
  } else if (relative_volume < 0.5) {
    colorClass = 'text-muted-foreground';
    barColorClass = 'bg-muted-foreground/50';
  }

  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
    return vol.toString();
  };

  // Find max volume for scaling the mini chart
  const maxVol = Math.max(
    current_volume, 
    ...(recent_volumes?.map(v => v.volume) || []), 
    avg_volume * 1.5 // Ensure average line isn't at the very top
  );

  return (
    <Card className="glass h-full relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <CardHeader className="pb-0">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Relative Volume
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Current vs 30-Day Avg</p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${colorClass}`}>{relative_volume.toFixed(2)}x</span>
            <p className="text-xs font-medium uppercase tracking-wider mt-1">{classification}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        
        <div className="flex justify-between items-end mb-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Today's Vol</p>
            <p className="font-semibold">{formatVolume(current_volume)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Avg Vol</p>
            <p className="font-semibold">{formatVolume(avg_volume)}</p>
          </div>
        </div>

        {/* Mini Volume Chart */}
        {recent_volumes && recent_volumes.length > 0 && (
          <div className="h-20 flex items-end justify-between gap-1 relative mt-2">
            {/* Average Line */}
            <div 
              className="absolute w-full border-t border-dashed border-muted-foreground/50 z-0"
              style={{ bottom: `${(avg_volume / maxVol) * 100}%` }}
            />
            <span className="absolute text-[9px] text-muted-foreground right-0 bg-background/80 px-1 rounded-sm z-10" style={{ bottom: `calc(${(avg_volume / maxVol) * 100}% + 2px)` }}>AVG</span>

            {recent_volumes.map((v, i) => (
              <div
                key={i}
                className={`w-full rounded-t-sm z-10 opacity-70 ${v.is_above_avg ? 'bg-primary' : 'bg-muted'}`}
                style={{ height: `${Math.max(2, (v.volume / maxVol) * 100)}%` }}
                title={`${v.date}: ${formatVolume(v.volume)}`}
              />
            ))}
            {/* Current Day */}
            <div
              className={`w-full rounded-t-sm z-10 ${barColorClass} shadow-[0_0_8px_rgba(0,0,0,0.2)]`}
              style={{ height: `${Math.max(2, (current_volume / maxVol) * 100)}%` }}
              title={`Today: ${formatVolume(current_volume)}`}
            />
          </div>
        )}

      </CardContent>
    </Card>
  );
}
