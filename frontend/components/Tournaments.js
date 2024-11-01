import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Tournaments() {
	return (
		<section className="py-20 bg-gray-100">
			<div className="container mx-auto px-4">
				<h3 className="text-3xl font-bold text-center mb-12">
					Featured Tournaments
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardHeader>
								<CardTitle>Tournament {i}</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="aspect-video bg-gray-200 mb-4 rounded" />
								<p className="text-sm text-gray-600 mb-2">
									Date: May {10 + i}, 2023
								</p>
								<p className="text-sm text-gray-600 mb-4">
									Prize Pool: 1000 BASE
								</p>
								<div className="flex justify-between items-center">
									<span className="text-sm font-semibold">
										Funded: 60%
									</span>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
				<div className="max-w-md mx-auto">
					<Card>
						<CardHeader>
							<CardTitle>Join Tournament</CardTitle>
						</CardHeader>
						<CardContent>
							<form className="space-y-4">
								<div>
									<Label htmlFor="join-tournament-id">
										Tournament ID
									</Label>
									<Input
										id="join-tournament-id"
										placeholder="Enter Tournament ID"
									/>
								</div>
								<Button className="w-full">
									Join Tournament
								</Button>
							</form>
						</CardContent>
					</Card>
				</div>
				<div className="mt-8 flex flex-col items-center">
					<img
						src="./streamtide.png"
						alt="StreamTide Logo"
						className="mb-4 w-26 h-24"
					/>
					<Button
						size="lg"
						className="bg-purple-600 hover:bg-purple-700 text-white"
						onClick={() =>
							window.open(
								"https://streamtide.io/profile/0x944C8e0C05aa90C3C03C16b0703fF66e2ecaa2fa",
								"_blank"
							)
						}
					>
						Support us on StreamTide
					</Button>
				</div>
			</div>
		</section>
	);
}
