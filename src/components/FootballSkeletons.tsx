import React from "react";

export function BentoStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
      {[...Array(4)].map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-stone-850 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-stone-200 dark:bg-stone-800 rounded-xl" />
          <div className="space-y-2 flex-1">
            <div className="h-2.5 bg-stone-200 dark:bg-stone-800 rounded w-16" />
            <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UpcomingMatchSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      {[...Array(2)].map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between h-[210px]"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-20" />
              <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-16" />
            </div>

            <div className="flex items-center justify-around py-2">
              <div className="text-center flex flex-col items-center w-20 space-y-2">
                <div className="w-10 h-10 bg-stone-200 dark:bg-stone-800 rounded-full" />
                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-14" />
              </div>

              <div className="text-center flex flex-col items-center space-y-1.5">
                <div className="h-5 bg-stone-200 dark:bg-stone-800 rounded w-10" />
                <div className="h-2.5 bg-stone-200 dark:bg-stone-800 rounded w-8" />
              </div>

              <div className="text-center flex flex-col items-center w-20 space-y-2">
                <div className="w-10 h-10 bg-stone-200 dark:bg-stone-800 rounded-full" />
                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-14" />
              </div>
            </div>
          </div>

          <div className="mt-4 h-9 bg-stone-200 dark:bg-stone-800 rounded-xl w-full" />
        </div>
      ))}
    </div>
  );
}

export function FixtureCardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[...Array(6)].map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between h-[240px]"
        >
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-20" />
              <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-16" />
            </div>

            <div className="flex items-center justify-around py-3">
              <div className="text-center flex flex-col items-center w-20 space-y-2">
                <div className="w-12 h-12 bg-stone-200 dark:bg-stone-800 rounded-full" />
                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-14" />
              </div>

              <div className="h-6 bg-stone-200 dark:bg-stone-800 rounded-lg w-12" />

              <div className="text-center flex flex-col items-center w-20 space-y-2">
                <div className="w-12 h-12 bg-stone-200 dark:bg-stone-800 rounded-full" />
                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-14" />
              </div>
            </div>

            <div className="flex justify-center mt-2">
              <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-28" />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
            <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-24" />
            <div className="h-7 bg-stone-200 dark:bg-stone-800 rounded-lg w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LiveMatchSkeleton() {
  return (
    <div className="bg-stone-900 dark:bg-black rounded-3xl p-6 border border-stone-800 relative overflow-hidden shadow-2xl animate-pulse h-[160px] flex flex-col justify-center">
      <div className="absolute top-4 right-4 h-5 bg-stone-800 rounded-full w-24" />
      <div className="h-3 bg-stone-800 rounded w-16 mb-4" />
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center justify-center gap-6 w-full md:w-auto">
          <div className="text-center flex flex-col items-center w-24 space-y-2">
            <div className="w-12 h-12 bg-stone-800 rounded-full" />
            <div className="h-3 bg-stone-800 rounded w-14" />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="h-8 bg-stone-800 rounded w-8" />
            <div className="h-6 bg-stone-800 rounded w-2" />
            <div className="h-8 bg-stone-800 rounded w-8" />
          </div>

          <div className="text-center flex flex-col items-center w-24 space-y-2">
            <div className="w-12 h-12 bg-stone-800 rounded-full" />
            <div className="h-3 bg-stone-800 rounded w-14" />
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end space-y-2">
          <div className="h-3 bg-stone-800 rounded w-20" />
          <div className="h-2.5 bg-stone-800 rounded w-32" />
        </div>
      </div>
    </div>
  );
}
