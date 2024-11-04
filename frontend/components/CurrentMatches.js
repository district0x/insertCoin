import React, { useState, useEffect, useCallback } from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { ethers } from "ethers";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";
import Spinner from "./Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

const CurrentMatches = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(1);
  const [ethPriceInUsd, setEthPriceInUsd] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(true);
  const [currentPage, setCurrentPage] = React.useState(0);
  const matchesPerPage = 5;

  const totalPages = Math.ceil(matches.length / matchesPerPage);
  const paginatedMatches = matches.slice(
    currentPage * matchesPerPage,
    (currentPage + 1) * matchesPerPage
  );

  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const {
    data: matchData,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    contract,
    method: "matches",
    params: [index],
  });

  const fetchEthPrice = async () => {
    try {
      const response = await fetch("/api/eth-price");
      const data = await response.json();
      const price = data.ethereum.usd;
      setEthPriceInUsd(price);
    } catch (error) {
      console.error("Failed to fetch ETH price:", error);
    }
  };

  useEffect(() => {
    fetchEthPrice();
  }, []);

  const processMatchData = useCallback((data, idx) => {
    const processedMatch = {
      player1: data[0],
      player2: data[1],
      player1Amount: data[2],
      player2Amount: data[3],
      donatedAmount: data[5],
      totalAmount: data[4],
      isOpen: data[6],
    };
    return processedMatch;
  }, []);

  useEffect(() => {
    const fetchMatch = async () => {
      if (!isLoading && matchData && !error && hasMoreMatches) {
        if (matchData[0] === "0x0000000000000000000000000000000000000000") {
          setHasMoreMatches(false);
          setLoading(false);
          return;
        }

        const newMatch = processMatchData(matchData, index);
        setMatches((prevMatches) => [...prevMatches, newMatch]);
        setIndex((prevIndex) => prevIndex + 1);
        refetch();
      } else if (error) {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [
    matchData,
    isLoading,
    error,
    refetch,
    index,
    hasMoreMatches,
    processMatchData,
  ]);

  const weiToUsd = useCallback(
    (wei) => {
      const eth = ethers.utils.formatEther(wei);
      const usdValue = (parseFloat(eth) * ethPriceInUsd).toFixed(2);
      return usdValue;
    },
    [ethPriceInUsd]
  );

  return (
    <div className="max-w-full mx-auto overflow-x-auto">
      <h4 className="text-2xl font-bold mb-4">Current Matches</h4>

      {loading && matches.length === 0 && (
        <Spinner className="text-center mt-4 w-screen m-auto" />
      )}
      {matches.length === 0 && !loading && <p>No matches found.</p>}
      {matches.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Match ID</TableHead>
                <TableHead>Player 1</TableHead>
                <TableHead>Player 2</TableHead>
                <TableHead>Player 1 Amount</TableHead>
                <TableHead>Player 2 Amount</TableHead>
                <TableHead>Donated Amount</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Is Open</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedMatches.map((match, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    {currentPage * matchesPerPage + idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {match.player1}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {match.player2}
                  </TableCell>
                  <TableCell>${weiToUsd(match.player1Amount)}</TableCell>
                  <TableCell>${weiToUsd(match.player2Amount)}</TableCell>
                  <TableCell>${weiToUsd(match.donatedAmount)}</TableCell>
                  <TableCell>${weiToUsd(match.totalAmount)}</TableCell>
                  <TableCell>{match.isOpen ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <span>
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
              }
              disabled={currentPage === totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}

      {loading && matches.length > 0 && (
        <p className="text-center mt-4">
          <Spinner /> Loading more matches...
        </p>
      )}
    </div>
  );
};

export default CurrentMatches;
