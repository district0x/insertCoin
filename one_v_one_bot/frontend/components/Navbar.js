import Link from "next/link";
import { client, chain } from "../app/client";
import { ConnectButton } from "thirdweb/react";

export default function Navbar() {
	return (
		<header className="border-b bg-gray-900 text-white">
			<div className="container mx-auto px-4 py-4 flex items-center justify-between">
				<div className="flex items-center space-x-8">
					<h1 className="text-2xl font-bold">One v One</h1>
					<nav className="hidden md:flex space-x-4">
						<Link href="#" className="text-sm font-medium">
							Tournaments
						</Link>
						<Link href="#" className="text-sm font-medium">
							How It Works
						</Link>
						<Link href="#" className="text-sm font-medium">
							Community
						</Link>
						<Link href="#" className="text-sm font-medium">
							About One v One
						</Link>
					</nav>
				</div>
				<ConnectButton client={client} chain={chain} />
			</div>
		</header>
	);
}
