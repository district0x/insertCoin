import { useContract } from "./useContract";
import { useWalletClient } from "wagmi";
import { BaseError } from "viem";

export function useMatch() {
  const contract = useContract();
  const { data: walletClient } = useWalletClient();

  const createMatch = async (amount: bigint) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.startMatch(
        [amount, "0x0000000000000000000000000000000000000000"],
        {
          account: walletClient.account.address,
          value: amount,
          gas: await contract.estimateGas.startMatch(
            [amount, "0x0000000000000000000000000000000000000000"],
            { account: walletClient.account.address, value: amount }
          ),
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating match:", error);
      if (error instanceof BaseError && error.message?.includes('CORS')) {
        throw new Error('Network connection issue. Please try again.');
      }
      throw error;
    }
  };

  const create2v2Match = async (amount: bigint) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.start2v2Match(
        [amount, "0x0000000000000000000000000000000000000000"],
        {
          account: walletClient.account.address,
          value: amount,
          gas: await contract.estimateGas.start2v2Match(
            [amount, "0x0000000000000000000000000000000000000000"],
            { account: walletClient.account.address, value: amount }
          ),
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating 2v2 match:", error);
      if (error instanceof BaseError && error.message?.includes('CORS')) {
        throw new Error('Network connection issue. Please try again.');
      }
      throw error;
    }
  };

  const create5v5Match = async (amount: bigint) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.start5v5Match(
        [amount, "0x0000000000000000000000000000000000000000"],
        {
          account: walletClient.account.address,
          value: amount,
          gas: await contract.estimateGas.start5v5Match(
            [amount, "0x0000000000000000000000000000000000000000"],
            { account: walletClient.account.address, value: amount }
          ),
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating 5v5 match:", error);
      if (error instanceof BaseError && error.message?.includes('CORS')) {
        throw new Error('Network connection issue. Please try again.');
      }
      throw error;
    }
  };

  const joinMatch = async (matchId: bigint, amount: bigint) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.joinMatch([matchId], {
        account: walletClient.account.address,
        value: amount,
      });
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error joining match:", error);
      throw error;
    }
  };

  const join2v2Team = async (
    matchId: bigint,
    isTeamA: boolean,
    amount: bigint
  ) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.join2v2Team(
        [matchId, isTeamA],
        {
          account: walletClient.account.address,
          value: amount,
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error joining 2v2 team:", error);
      throw error;
    }
  };

  const join5v5Team = async (
    matchId: bigint,
    isTeamA: boolean,
    amount: bigint
  ) => {
    if (!contract || !walletClient) return;

    try {
      const { request } = await contract.simulate.join5v5Team(
        [matchId, isTeamA],
        {
          account: walletClient.account.address,
          value: amount,
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error joining 5v5 team:", error);
      throw error;
    }
  };

  return {
    createMatch,
    create2v2Match,
    create5v5Match,
    joinMatch,
    join2v2Team,
    join5v5Team,
  };
}
