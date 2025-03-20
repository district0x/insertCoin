import React from "react";

interface MatchSkeletonProps {
  id?: number;
}

const MatchSkeleton = ({ id }: MatchSkeletonProps) => (
  <div className="p-6 border rounded-lg animate-pulse transition-opacity duration-300">
    <div className="flex justify-between items-start mb-4">
      <div>
        <div className="h-5 w-32 bg-gray-200 rounded mb-2 flex items-center">
          {id && (
            <span className="text-xs text-gray-500 ml-2">Loading match #{id}...</span>
          )}
        </div>
        <div className="h-4 w-24 bg-gray-200 rounded"></div>
      </div>
      <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
    </div>
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="h-4 w-16 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 w-24 bg-gray-200 rounded ml-2"></div>
      </div>
      <div className="space-y-1">
        <div className="h-4 w-16 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 w-24 bg-gray-200 rounded ml-2"></div>
      </div>
      <div className="h-4 w-40 bg-gray-200 rounded mt-2"></div>
    </div>
  </div>
);

export default MatchSkeleton; 