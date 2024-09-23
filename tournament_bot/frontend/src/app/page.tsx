"use client";

import Navbar from "../components/Navbar";
import Welcome from "../components/Welcome";
import CreateTournament from "../components/CreateTournament";
import EndTournament from "@/components/EndTournament";
import ListTournament from "../components/ListTournaments";
import DonateToTournament from "@/components/DonateToTournament";
import JoinTournament from "@/components/JoinTournament";
import ClaimReward from "@/components/ClaimReward";
// import WalletAddressComponent from "@/components/test";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Navbar />

      {/* Welcome component outside the main container for full width */}
      <Welcome />

      {/* Main content within container for centered and limited width */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tournament Management Section with dynamic spacing and wrapping */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <CreateTournament />
          <EndTournament />
        </div>

        {/* Donation Component with full width in a dedicated section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <DonateToTournament />
          <JoinTournament />
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ClaimReward />
          {/* <JoinTournament /> */}
        </div>

        {/* List of Tournaments displayed below */}
        <section className="mt-8">
          <ListTournament />
        </section>
        {/* <WalletAddressComponent /> */}
        {/* Uncomment below for additional components */}
      </main>
      {/* Footer could be added here with similar styling */}
      <footer className="bg-gray-800 text-white text-center p-4">
        © 2024
      </footer>
    </div>
  );
}
