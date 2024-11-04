import { Twitch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TwitchCard() {
	return (
		<section className="py-20">
			<div className="container mx-auto px-4">
				<h3 className="text-3xl font-bold text-center mb-12">
					Our Twitch Channel
				</h3>
				<div className="flex flex-col items-center justify-center">
					<Card className="w-full max-w-3xl mb-8">
						<CardContent className="p-6">
							<div className="aspect-video bg-gray-200 mb-4 rounded">
								{/* Placeholder for Twitch embed */}
								<div className="w-full h-full flex items-center justify-center">
									<Twitch className="h-16 w-16 text-purple-600" />
								</div>
							</div>
							<h4 className="text-xl font-semibold mb-2">
								Insert Coin Live
							</h4>
							<p className="text-gray-600 mb-4">
								Watch live tournaments, interviews with pro
								gamers, and community events!
							</p>
							<Button className="w-full">
								Follow Us on Twitch
								<Twitch className="ml-2 h-4 w-4" />
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</section>
	);
}
