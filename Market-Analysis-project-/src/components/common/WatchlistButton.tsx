import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useWatchlistStore } from '@/store/watchlistStore';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WatchlistButtonProps {
  ticker: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'ghost' | 'outline';
  showLabel?: boolean;
}

export function WatchlistButton({ 
  ticker, 
  size = 'icon', 
  variant = 'ghost',
  showLabel = false 
}: WatchlistButtonProps) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const isWatched = isInWatchlist(ticker);

  const toggleWatchlist = () => {
    if (isWatched) {
      removeFromWatchlist(ticker);
    } else {
      addToWatchlist(ticker);
    }
  };

  const buttonContent = (
    <Button
      size={size}
      variant={variant}
      onClick={toggleWatchlist}
      className={isWatched ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-foreground'}
    >
      <motion.div
        whileTap={{ scale: 0.8 }}
        whileHover={{ scale: 1.1 }}
      >
        <Star
          className={`${size === 'icon' ? 'h-5 w-5' : 'h-4 w-4'} ${isWatched ? 'fill-current' : ''}`}
        />
      </motion.div>
      {showLabel && (
        <span className="ml-2">
          {isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
        </span>
      )}
    </Button>
  );

  if (showLabel) {
    return buttonContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{isWatched ? 'Remove from watchlist' : 'Add to watchlist'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}