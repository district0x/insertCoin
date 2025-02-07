import { useContract } from "./useContract";
import { useWalletClient } from "wagmi";

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
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating match:", error);
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
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating 2v2 match:", error);
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
        }
      );
      return walletClient.writeContract(request);
    } catch (error) {
      console.error("Error creating 5v5 match:", error);
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
