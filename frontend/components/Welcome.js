import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import MatchingPoolDisplay from "./MatchingPool";

export default function Welcome() {
	return (
		<section className="relative py-20 overflow-hidden">
			<div className="absolute inset-0 z-0">
				<div className="w-full h-full bg-black">
					<div className="absolute inset-0 bg-blue-500 opacity-20">
						<div
							className="absolute inset-0"
							style={{
								backgroundImage: `url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/R881563d6444b370fa4ceea0c3183bb4c-OAU5qkVuIr7kjqtrNuC1QXC6EAI0Za.gif')`,
								backgroundSize: "cover",
								backgroundPosition: "center",
								mixBlendMode: "screen",
							}}
						></div>
					</div>
				</div>
			</div>
			<div className="container mx-auto px-4 relative z-10">
				<div className="max-w-3xl mx-auto text-center text-white">
					<h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
						Crowdfund Your Esports Dreams
					</h2>
					<p className="text-xl md:text-2xl mb-8 leading-relaxed">
						Fuel your competitive spirit with community-backed
						tournaments.
					</p>
					<MatchingPoolDisplay />
					<div className="flex justify-center">
						<Button
							size="lg"
							className="bg-yellow-400 text-black hover:bg-yellow-300 transition-all duration-300 flex items-center"
							style={{
								fontFamily: "'Press Start 2P', cursive",
								padding: "1rem 2rem",
								fontSize: "1.5rem",
								textShadow: "2px 2px 0px rgba(0,0,0,0.2)",
								boxShadow:
									"0 0 10px rgba(255,255,0,0.5), 0 0 20px rgba(255,255,0,0.3), 0 0 30px rgba(255,255,0,0.1)",
								animation: "glow 2s ease-in-out infinite",
							}}
						>
							Press Start
							<MessageSquare className="ml-2 h-6 w-6" />
						</Button>
					</div>
					<style jsx>{`
						@keyframes glow {
							0%,
							100% {
								opacity: 1;
								transform: scale(1);
							}
							50% {
								opacity: 0.8;
								transform: scale(0.98);
							}
						}
					`}</style>
				</div>
			</div>
		</section>
	);
}
