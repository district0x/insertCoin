import React, { useState, useEffect } from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { client, chain as chainl } from "../app/client"; // Ensure correct import names
import ABI from "../lib/contractABI.json";
import Spinner from "./Spinner";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS; // Your contract address here

const Tournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [errorOccurred, setErrorOccurred] = useState(false);

  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const {
    data: tournamentData,
    isLoading,
    error,
  } = useReadContract({
    contract,
    method: "tournaments",
    params: [index],
  });

  useEffect(() => {
    if (!isLoading && tournamentData && !error && index < 10) {
      const details = {
        numEntrants: tournamentData[0],
        totalDonations: tournamentData[1],
        remainingBalance: tournamentData[2],
        winnersPercentage: tournamentData[3],
        multisigPercentage: tournamentData[4],
        isActive: tournamentData[5],
        hasStarted: tournamentData[6],
      };
      setTournaments((prevTournaments) => [...prevTournaments, details]);
      setIndex(index + 1);
    } else {
      setErrorOccurred(true);
      setLoading(false);
    }
  }, [tournamentData, isLoading, error, index]);

  useEffect(() => {
    if (index >= 10 || errorOccurred) {
      setLoading(false);
    }
  }, [index, errorOccurred]);

  if (loading)
    return (
      <p>
        <Spinner className="text-center mt-4 w-screen	m-auto" />
      </p>
    );
  if (tournaments.length === 0 && !loading) return <p>No tournaments found.</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-5xl font-bold mb-4 text-grey-600 text-center">
        Tournaments
      </h1>
      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-blue-100 dark:text-blue-100">
          <thead className="text-xs text-white uppercase bg-blue-600 border-b border-blue-400 dark:text-white">
            <tr>
              <th scope="col" className="px-6 py-3 bg-blue-500">
                Tournament ID
              </th>
              {Object.keys(tournaments[0] || {}).map((key, index) => (
                <th key={index} scope="col" className="px-6 py-3 bg-blue-500">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tournaments.map((tournament, idx) => (
              <tr key={idx} className="bg-blue-600 border-b border-blue-400">
                <td className="px-6 py-4 font-medium text-blue-50 whitespace-nowrap bg-blue-500">
                  {idx}
                </td>
                {Object.values(tournament).map((value, index) => (
                  <td
                    key={index}
                    className="px-6 py-4 bg-blue-500 text-blue-50"
                  >
                    {typeof value === "boolean"
                      ? value
                        ? "Yes"
                        : "No"
                      : value.toString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Tournaments;
