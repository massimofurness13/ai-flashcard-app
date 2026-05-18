"use client";

import { Button } from "@/components/ui/button";

interface RatingButtonsProps {
  onRate: (quality: number) => void;
  disabled?: boolean;
}

/**
 * Four-button rating row. Quality values match the SM-2 scale we
 * persist in ReviewLog:
 *   Again = 1, Hard = 2, Good = 3, Easy = 5
 *
 * The keyboard digit labels under each button (1/2/3/4) are just the
 * shortcut hint — the underlying scored value is the SM-2 quality.
 */
export function RatingButtons({ onRate, disabled }: RatingButtonsProps) {
  return (
    <div className="flex gap-2 justify-center">
      <Button
        variant="outline"
        onClick={() => onRate(1)}
        disabled={disabled}
        className="flex-1 max-w-[120px] border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        <div className="text-center">
          <div className="font-semibold">Again</div>
          <div className="text-xs opacity-75">1</div>
        </div>
      </Button>

      <Button
        variant="outline"
        onClick={() => onRate(2)}
        disabled={disabled}
        className="flex-1 max-w-[120px] border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950"
      >
        <div className="text-center">
          <div className="font-semibold">Hard</div>
          <div className="text-xs opacity-75">2</div>
        </div>
      </Button>

      <Button
        variant="outline"
        onClick={() => onRate(3)}
        disabled={disabled}
        className="flex-1 max-w-[120px] border-yellow-300 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 dark:border-yellow-800 dark:text-yellow-400 dark:hover:bg-yellow-950"
      >
        <div className="text-center">
          <div className="font-semibold">Good</div>
          <div className="text-xs opacity-75">3</div>
        </div>
      </Button>

      <Button
        variant="outline"
        onClick={() => onRate(5)}
        disabled={disabled}
        className="flex-1 max-w-[120px] border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
      >
        <div className="text-center">
          <div className="font-semibold">Easy</div>
          <div className="text-xs opacity-75">4</div>
        </div>
      </Button>
    </div>
  );
}
