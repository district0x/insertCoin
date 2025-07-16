import React from "react";

interface MatchSkeletonProps {
  id?: number;
}

const MatchSkeleton = ({ id }: MatchSkeletonProps) => (
  <div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-6 animate-pulse transition-opacity duration-300">
    {/* Header */}
    <div className="flex justify-between items-start mb-4">
      <div>
        <div className="h-5 w-28 bg-gray-600 rounded mb-1"></div>
        <div className="h-3 w-32 bg-gray-600 rounded"></div>
      </div>
      <div className="h-5 w-16 bg-gray-600 rounded-full"></div>
    </div>

    {/* Prize Pool Section */}
    <div className="bg-gradient-to-r from-red-500/20 to-red-500/10 rounded-lg p-4 mb-4 border border-red-500/20">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-4 w-4 bg-gray-600 rounded"></div>
        <div className="h-3 w-16 bg-gray-600 rounded"></div>
      </div>
      <div className="h-6 w-24 bg-gray-600 rounded"></div>
    </div>

    {/* Key Info Row */}
    <div className="flex justify-between items-center mb-4">
      <div className="text-center">
        <div className="h-3 w-12 bg-gray-600 rounded mb-1"></div>
        <div className="h-4 w-16 bg-gray-600 rounded"></div>
      </div>
      <div className="text-center">
        <div className="h-3 w-12 bg-gray-600 rounded mb-1"></div>
        <div className="h-4 w-8 bg-gray-600 rounded"></div>
      </div>
      <div className="text-center">
        <div className="h-3 w-12 bg-gray-600 rounded mb-1"></div>
        <div className="h-4 w-12 bg-gray-600 rounded"></div>
      </div>
    </div>

    {/* Players List */}
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-3 w-3 bg-gray-600 rounded"></div>
        <div className="h-3 w-12 bg-gray-600 rounded"></div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-gray-600 rounded-full"></div>
          <div className="h-3 w-20 bg-gray-600 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-gray-600 rounded-full"></div>
          <div className="h-3 w-20 bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>

    {/* Action Button */}
    <div className="h-10 w-full bg-gray-600 rounded-lg"></div>

    {id && (
      <div className="absolute top-2 right-2">
        <span className="text-xs text-gray-400">#{id}</span>
      </div>
    )}
  </div>
);

export default MatchSkeleton; 