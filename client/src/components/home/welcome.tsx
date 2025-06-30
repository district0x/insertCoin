import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Users, Trophy } from "lucide-react";
// import MatchingPoolDisplay from "./MatchingPool";

export default function Welcome() {
	return (
		<section className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white py-20">
			<div className="container mx-auto px-4 text-center">
				<h1 className="text-5xl md:text-6xl font-bold mb-6">
					One v One
				</h1>
				<p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto">
					The ultimate Web3 gaming platform for competitive 1v1, 2v2, and 5v5 matches with real prizes
				</p>

				<div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
					<Link href="/matches/create">
						<Button size="lg" className="bg-white text-indigo-900 hover:bg-gray-100">
							Create Match
							<ArrowRight className="ml-2 h-5 w-5" />
						</Button>
					</Link>
					<Link href="/wallet-signature">
						<Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-indigo-900">
							<Shield className="mr-2 h-5 w-5" />
							Link Discord Wallet
						</Button>
					</Link>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
					<div className="flex flex-col items-center">
						<Shield className="h-12 w-12 mb-4 text-blue-300" />
						<h3 className="text-xl font-semibold mb-2">Secure & Fair</h3>
						<p className="text-gray-300">
							Blockchain-powered matches with transparent prize distribution
						</p>
					</div>
					<div className="flex flex-col items-center">
						<Users className="h-12 w-12 mb-4 text-green-300" />
						<h3 className="text-xl font-semibold mb-2">Community Driven</h3>
						<p className="text-gray-300">
							Join our Discord community and compete with players worldwide
						</p>
					</div>
					<div className="flex flex-col items-center">
						<Trophy className="h-12 w-12 mb-4 text-yellow-300" />
						<h3 className="text-xl font-semibold mb-2">Win Real Prizes</h3>
						<p className="text-gray-300">
							Earn ETH and tokens by winning competitive matches
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
