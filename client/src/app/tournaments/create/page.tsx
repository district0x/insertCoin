"use client";

import * as React from "react";

export default function CreateTournament() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Create Tournament</h1>

      <form className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Maximum Participants</label>
          <input
            type="number"
            className="w-full p-2 border rounded-md"
            min="4"
            max="64"
            step="4"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Entry Fee (ETH)</label>
          <input
            type="number"
            className="w-full p-2 border rounded-md"
            step="0.01"
            placeholder="0.1"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Winners Percentage</label>
          <input
            type="number"
            className="w-full p-2 border rounded-md"
            min="1"
            max="95"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Multisig Percentage</label>
          <input
            type="number"
            className="w-full p-2 border rounded-md"
            min="1"
            max="10"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Create Tournament
        </button>
      </form>
    </div>
  );
}
