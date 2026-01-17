import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Bucket } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SeatMapProps {
  buckets: Bucket[];
  totalSeats?: number;
}

export function SeatMap({ buckets, totalSeats = 192 }: SeatMapProps) {
  // Generate a flat array of seat objects based on buckets
  // This is a visualization hack: we don't have individual seat rows in DB, 
  // so we visualize the *proportion* of seats per bucket.
  
  const generateSeats = () => {
    const seats: { id: string; bucket: Bucket; status: 'available' | 'sold'; type: 'business' | 'economy' }[] = [];
    
    // Sort buckets by price desc (Business first usually)
    const sortedBuckets = [...buckets].sort((a, b) => b.price - a.price);

    sortedBuckets.forEach(bucket => {
      // Add sold seats first
      for (let i = 0; i < bucket.sold; i++) {
        seats.push({ 
          id: `${bucket.code}-s-${i}`, 
          bucket, 
          status: 'sold',
          type: bucket.class.toLowerCase() as 'business' | 'economy'
        });
      }
      // Add available seats
      const available = bucket.allocated - bucket.sold;
      for (let i = 0; i < available; i++) {
        seats.push({ 
          id: `${bucket.code}-a-${i}`, 
          bucket, 
          status: 'available',
          type: bucket.class.toLowerCase() as 'business' | 'economy'
        });
      }
    });

    // Fill remaining if any (unallocated - shouldn't happen in this model but good safety)
    while (seats.length < totalSeats) {
      seats.push({ 
        id: `unalloc-${seats.length}`, 
        bucket: buckets[0], // fallback
        status: 'sold', // treat unallocated as blocked/sold visually
        type: 'economy' 
      });
    }

    return seats.slice(0, totalSeats); // Cap at totalSeats
  };

  const seats = generateSeats();

  return (
    <div className="p-4 bg-card rounded-xl border shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display font-semibold text-lg">Seat Map Visualization</h3>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500 rounded-sm"></div> Business</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Economy</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded-sm"></div> Sold</div>
        </div>
      </div>
      
      {/* Plane fuselage shape container */}
      <div className="relative mx-auto max-w-[300px] bg-slate-100 dark:bg-slate-900 rounded-t-[100px] rounded-b-[40px] p-8 border-4 border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-6 gap-2">
          {seats.map((seat, i) => (
            <Tooltip key={seat.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.005 }}
                  className={cn(
                    "w-6 h-6 rounded-sm cursor-help transition-colors duration-300",
                    seat.status === 'sold' 
                      ? "bg-slate-300 dark:bg-slate-700 opacity-50" 
                      : seat.type === 'business' 
                        ? "bg-purple-500 hover:bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]" 
                        : "bg-blue-500 hover:bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
                    // Aisle spacer styling
                    (i % 6 === 2) ? "mr-4" : "" 
                  )}
                />
              </TooltipTrigger>
              <TooltipContent className="bg-popover border-border text-xs">
                <p className="font-bold">{seat.bucket.code}</p>
                <p>Price: ${seat.bucket.price}</p>
                <p>Status: {seat.status.toUpperCase()}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
