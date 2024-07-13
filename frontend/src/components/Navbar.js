import Link from "next/link";
import { ConnectButton } from "thirdweb/react";
import { client, chain } from "../app/client";

const Navbar = () => {
  return (
    <header className="bg-gray-900 text-white py-4 px-6 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="#" className="text-xl font-bold">
          One vs One
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <ConnectButton client={client} chain={chain} />
      </div>
    </header>
  );
};

export default Navbar;
