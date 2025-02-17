import * as React from "react";
import Link from "next/link";

export default function TournamentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tournaments</h1>
        <Link
          href="/tournaments/create"
          className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Create Tournament
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tournament cards will be rendered here */}
        <div className="p-6 border rounded-lg">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">Weekly Tournament</h3>
              <p className="text-sm text-muted-foreground">Prize Pool: 1 ETH</p>
            </div>
            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
              Filling
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Entry Fee:</span> 0.1 ETH
            </p>
            <p className="text-sm">
              <span className="font-medium">Players:</span> 8/16
            </p>
          </div>
          <div className="mt-4">
            <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md">
              Join Tournament
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
