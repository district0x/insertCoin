"use client";

import Navbar from "@/components/Navbar";
import Welcome from "@/components/Welcome";
import Features from "@/components/Features";
import StartMatch from "@/components/StartMatch";
import CloseMatch from "@/components/CloseMatch";
import DonateToMatch from "@/components/DonateToMatch";
import JoinMatch from "@/components/JoinMatch";
import CurrentMatches from "@/components/CurrentMatches";
import Tournaments from "@/components/Tournaments";
import TwitchCard from "@/components/TwitchCard";
import Footer from "@/components/Footer";

export default function Home() {
	return (
		<div className="flex flex-col min-h-screen">
			<Navbar />

			<main className="flex-grow">
				<Welcome />
				<Features />

				<section className="py-20">
					<div className="container mx-auto px-4">
						<h3 className="text-3xl font-bold text-center mb-12">
							Support the Players
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
							<StartMatch />
							<CloseMatch />
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
							<DonateToMatch />
							<JoinMatch />
						</div>
						<CurrentMatches />
					</div>
				</section>
				<Tournaments />
				<TwitchCard />
			</main>

			<Footer />
		</div>
	);
}

// "use client";

// import Navbar from "../components/Navbar";
// import Welcome from "../components/Welcome";
// import StartMatch from "../components/StartMatch";
// import CloseMatch from "@/components/CloseMatch";
// import CurrentMatches from "../components/CurrentMatches";
// import DonateToMatch from "@/components/DonateToMatch";
// import JoinMatch from "@/components/JoinMatch";
// import { Button } from "@/components/ui/button";
// // import WalletAddressComponent from "@/components/test";

// export default function Home() {
// 	return (
// 		<div className="flex flex-col min-h-screen bg-gray-100">
// 			<Navbar />

// 			{/* Welcome component outside the main container for full width */}
// 			<Welcome />

// 			{/* Main content within container for centered and limited width */}
// 			<main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8">
// 				{/* Tournament Management Section with dynamic spacing and wrapping */}
// 				<div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
// 					<StartMatch />
// 					<CloseMatch />
// 				</div>

// 				{/* Donation Component with full width in a dedicated section */}
// 				<div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
// 					<DonateToMatch />
// 					<JoinMatch />
// 				</div>

// 				{/* List of Tournaments displayed below */}
// 				<section className="mt-8">
// 					<CurrentMatches />
// 				</section>
// 				{/* <WalletAddressComponent /> */}
// 				{/* Uncomment below for additional components */}
// 			</main>
// 			{/* Footer could be added here with similar styling */}
// 			<footer className="bg-gray-800 text-white text-center p-4">
// 				© 2024
// 			</footer>
// 		</div>
// 	);
// }
