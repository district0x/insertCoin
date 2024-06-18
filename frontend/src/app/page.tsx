"use client";

import Navbar from "../components/Navbar";
import Welcome from "../components/Welcome";
import CreateTournament from "../components/CreateTournament";
import EndTournament from "@/components/EndTournament";
import ListTournament from "../components/ListTournaments";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Welcome />
        {/* Tournament Management Section */}
        <div className="mt-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <CreateTournament />
          </div>
          <div className="flex-1">
            <EndTournament />
          </div>
        </div>
        <ListTournament />
      </main>
      {/* Footer goes here */}
    </div>
  );
}
