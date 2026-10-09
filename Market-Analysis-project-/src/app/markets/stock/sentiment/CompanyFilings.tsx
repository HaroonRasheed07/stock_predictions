'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ExternalLink, FileText } from 'lucide-react';
import { fetchCompanyFilings } from '@/lib/api';

interface CompanyFilingsProps {
  ticker: string;
}

export function CompanyFilings({ ticker }: CompanyFilingsProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['company-filings', ticker],
    queryFn: () => fetchCompanyFilings(ticker, 10),
    refetchInterval: 300000,
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
  });

  const filings = data?.filings || [];

  const formatFilingDate = (value?: string) => {
    if (!value) return 'Date unavailable';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return 'Date unavailable';
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  };

  return (
    <Card className="glass relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Company Filings</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Recent SEC filings for {ticker}</p>
          </div>
          {!isLoading && !isError && filings.length > 0 && (
            <Badge variant="outline" className="shrink-0">{filings.length} filings</Badge>
          )}
        </div>
        <Separator className="mt-4 bg-border/60" />
      </CardHeader>
      <CardContent className="relative pt-2">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl bg-muted/40" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive/70" />
            </div>
            <p className="text-sm font-medium">Unable to load SEC filings</p>
            <p className="mt-1 text-xs text-muted-foreground">The filings service did not respond.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && filings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No recent SEC filings found</p>
            <p className="mt-1 text-xs text-muted-foreground">Check back after the next filing deadline.</p>
          </div>
        )}

        {!isLoading && !isError && filings.length > 0 && (
          <div className="space-y-3">
            {filings.map((filing, idx) => (
              <div
                key={filing.accession || idx}
                className="group rounded-xl border border-border/50 bg-background/40 p-3 sm:p-4 shadow-sm hover:shadow-md hover:bg-muted/25 hover:border-border/80 transition-all"
              >
                <div className="flex items-start gap-3">
                  <Badge
                    variant="secondary"
                    className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium"
                  >
                    {filing.form}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{formatFilingDate(filing.filing_date)}</p>
                        {filing.description && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                            {filing.description}
                          </p>
                        )}
                      </div>
                      <a
                        href={filing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        aria-label={`Open ${filing.form} filing on SEC EDGAR`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !isError && data?.attribution && (
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{data.attribution}</p>
        )}
      </CardContent>
    </Card>
  );
}
