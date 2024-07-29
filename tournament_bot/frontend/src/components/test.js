import React, { useEffect, useState } from "react";
import { useContract, useContractEvents } from "thirdweb/react";
import { prepareEvent, watchContractEvents, getContract } from "thirdweb";
import { client, chain as chainl } from "../app/client";
import ABI from "../lib/contractABI.json";

const TournamentEvents = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  console.log("Getting contract instance");
  const contract = getContract({
    client,
    chain: chainl,
    address: contractAddress,
    abi: ABI,
  });

  const tournamentCreatedEvent = prepareEvent({
    signature:
      "event TournamentCreated(uint256 indexed tournamentId, uint256 numEntrants, uint8 winnersPercentage, uint8 multisigPercentage)",
  });

  useEffect(() => {
    const fetchData = async () => {
      console.log("Starting fetchData");
      try {
        console.log("Watching for TournamentCreated events");
        await watchContractEvents({
          contract: contract,
          events: [tournamentCreatedEvent],
          onEvents: (events) => {
            console.log("Received events:", events);
            // events.forEach((event) => {
            //   console.log("TournamentCreated event:", event);
            //   const {
            //     tournamentId,
            //     numEntrants,
            //     winnersPercentage,
            //     multisigPercentage,
            //   } = event.args;
            //   console.log(`Tournament ID: ${tournamentId}`);
            //   console.log(`Number of Entrants: ${numEntrants}`);
            //   console.log(`Winners Percentage: ${winnersPercentage}`);
            //   console.log(`Multisig Percentage: ${multisigPercentage}`);
            // });
            // setEvents(events);
          },
        });

        console.log("Finished watching events");
        setIsLoading(false);
      } catch (err) {
        console.error("Error occurred:", err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // console.log("Rendering component with state:", { isLoading, error, events });

  if (isLoading) {
    return <p>Loading contract or event data...</p>;
  }

  if (error) {
    return <p>An error occurred: {error.message}</p>;
  }

  return (
    <div>
      <h3>Tournament Events:</h3>
      {/* {events.length > 0 ? (
        <ul>
          {events.map((event, index) => (
            <li key={index}>
              Tournament ID: {event.args.tournamentId.toString()}, Entrants:{" "}
              {event.args.numEntrants.toString()}, Winners Percentage:{" "}
              {event.args.winnersPercentage.toString()}%, Multisig Percentage:{" "}
              {event.args.multisigPercentage.toString()}%
            </li>
          ))}
        </ul>
      ) : (
        <p>No tournaments have been created yet.</p>
      )} */}
    </div>
  );
};

export default TournamentEvents;
