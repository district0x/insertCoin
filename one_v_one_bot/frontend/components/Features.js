import { DollarSign, Users, Zap } from "lucide-react";

function FeatureCard({ icon, title, description }) {
	return (
		<div className="bg-white p-6 rounded-lg shadow-lg">
			<div className="flex items-center justify-center mb-4">{icon}</div>
			<h4 className="text-xl font-semibold mb-2 text-center">{title}</h4>
			<p className="text-gray-600 text-center">{description}</p>
		</div>
	);
}

export default function Features() {
	return (
		<section className="py-20 bg-gray-100">
			<div className="container mx-auto px-4">
				<h3 className="text-3xl font-bold text-center mb-12">
					Empowering Esports Through Crowdfunding
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					<FeatureCard
						icon={<Zap className="h-12 w-12 text-purple-600" />}
						title="Powered by Base"
						description="Leverage the speed and security of the Base network for seamless transactions and low fees."
					/>
					<FeatureCard
						icon={
							<DollarSign className="h-12 w-12 text-purple-600" />
						}
						title="Community-Driven Funding"
						description="Empower tournaments and players through decentralized crowdfunding."
					/>
					<FeatureCard
						icon={<Users className="h-12 w-12 text-purple-600" />}
						title="Vibrant Esports Ecosystem"
						description="Connect with a passionate community of gamers, organizers, and sponsors."
					/>
				</div>
			</div>
		</section>
	);
}
