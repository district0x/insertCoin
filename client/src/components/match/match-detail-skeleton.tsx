import React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

const MatchDetailSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/matches"
        className="flex items-center text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Matches
      </Link>
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    </div>
  );
};

export default MatchDetailSkeleton; 