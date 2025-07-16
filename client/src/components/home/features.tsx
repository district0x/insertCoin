import { DollarSign, Users, Zap } from "lucide-react";
import { ReactNode } from "react";

interface FeatureCardProps {
	icon: ReactNode;
	title: string;
	description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
	return (
		<div className="bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-sm border border-red-500/20 p-6 rounded-xl shadow-lg hover:border-red-500/40 transition-all duration-300">
			<div className="flex items-center justify-center mb-4">{icon}</div>
			<h4 className="text-xl font-semibold mb-2 text-center text-white">{title}</h4>
			<p className="text-gray-300 text-center">{description}</p>
		</div>
	);
}

export default function Features() {
	return (
		<section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black">
			<div className="container mx-auto px-4">
				<h3 className="text-3xl font-bold text-center mb-12 text-white">
					Empowering Esports Through Crowdfunding
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					<FeatureCard
						icon={<Zap className="h-12 w-12 text-red-400" />}
						title="Powered by Base"
						description="Leverage the speed and security of the Base network for seamless transactions and low fees."
					/>
					<FeatureCard
						icon={
							<DollarSign className="h-12 w-12 text-red-400" />
						}
						title="Community-Driven Funding"
						description="Empower tournaments and players through decentralized crowdfunding."
					/>
					<FeatureCard
						icon={<Users className="h-12 w-12 text-red-400" />}
						title="Vibrant Esports Ecosystem"
						description="Connect with a passionate community of gamers, organizers, and sponsors."
					/>
				</div>
			</div>
		</section>
	);
}
