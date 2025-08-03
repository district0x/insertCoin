export const ONEVONE_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_admin",
        type: "address",
      },
    ],
    name: "AdminAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_admin",
        type: "address",
      },
    ],
    name: "AdminRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_blacklisted",
        type: "address",
      },
    ],
    name: "BlacklistedAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "_blacklisted",
        type: "address",
      },
    ],
    name: "BlacklistedRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tournamentId",
        type: "uint256",
      },
    ],
    name: "Donate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint8",
        name: "version",
        type: "uint8",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "admin",
        type: "address",
      },
      {
        indexed: true,
        internalType: "bool",
        name: "winningTeamA",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "totalPrizePool",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "winnerShare",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "multisigShare",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "poolShare",
        type: "uint256",
      },
    ],
    name: "Match6v6Closed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "totalPrizePool",
        type: "uint256",
      },
    ],
    name: "Match6v6Ready",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "firstPlayer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isERC20",
        type: "bool",
      },
    ],
    name: "Match6v6Started",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "winner",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "winnerAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "multisigAmount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "poolAmount",
        type: "uint256",
      },
    ],
    name: "MatchClosed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "donor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "MatchDonation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "player2",
        type: "address",
      },
    ],
    name: "MatchJoined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "player1",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "matchAmount",
        type: "uint256",
      },
    ],
    name: "MatchStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "roundId",
        type: "uint256",
      },
    ],
    name: "MatchingPoolDonation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "MatchingPoolFilled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "teamAPlayer1",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "matchAmount",
        type: "uint256",
      },
    ],
    name: "Team2v2MatchStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "bool",
        name: "isTeamA",
        type: "bool",
      },
      {
        indexed: true,
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "playerPosition",
        type: "uint8",
      },
    ],
    name: "Team6v6Joined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isTeamA",
        type: "bool",
      },
    ],
    name: "TeamPlayerJoined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "TokenApprovalUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tournamentId",
        type: "uint256",
      },
    ],
    name: "TokenDonation",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "reason",
        type: "string",
      },
    ],
    name: "TokenValidationFailed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "tournamentId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "numEntrants",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "winnersPercentage",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "multisigPercentage",
        type: "uint8",
      },
    ],
    name: "TournamentCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "tournamentId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address[]",
        name: "winners",
        type: "address[]",
      },
      {
        indexed: false,
        internalType: "uint8[]",
        name: "winnersPercentages",
        type: "uint8[]",
      },
    ],
    name: "TournamentEnded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "tournamentId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "entrant",
        type: "address",
      },
    ],
    name: "TournamentJoined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "tournamentId",
        type: "uint256",
      },
    ],
    name: "TournamentStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "matchId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "teamPosition",
        type: "uint8",
      },
    ],
    name: "Winner6v6Payout",
    type: "event",
  },
  {
    inputs: [],
    name: "MAX_DECIMALS",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_DECIMALS",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_admin",
        type: "address",
      },
    ],
    name: "addAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_address",
        type: "address",
      },
    ],
    name: "addBlacklisted",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tournamentId",
        type: "uint256",
      },
    ],
    name: "allocateMatchingPoolToTournament",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_token",
        type: "address",
      },
      {
        internalType: "bool",
        name: "_approved",
        type: "bool",
      },
    ],
    name: "approveToken",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "approvedTokens",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_winningTeamPlayer",
        type: "address",
      },
    ],
    name: "close2v2Match",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "_winningTeamA",
        type: "bool",
      },
    ],
    name: "close6v6Match",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_winner",
        type: "address",
      },
    ],
    name: "closeMatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_numEntrants",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "_winnersPercentage",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "_multisigPercentage",
        type: "uint8",
      },
      {
        internalType: "contract IERC20",
        name: "_token",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_entryFee",
        type: "uint256",
      },
    ],
    name: "createTournament",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "currentTournamentRound",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tournamentId",
        type: "uint256",
      },
    ],
    name: "donate",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "contract IERC20",
        name: "_token",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "donateERC20ToMatchingPool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "donateTo2v2Match",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "donateTo6v6Match",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "donateToMatch",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tournamentId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "donateTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "erc20MatchingPools",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tournamentId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "contract IERC20",
        name: "_token",
        type: "address",
      },
    ],
    name: "fillUpERC20MatchingPool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "fillUpMatchingPool",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "_isTeamA",
        type: "bool",
      },
    ],
    name: "get6v6TeamMembers",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getContractBalance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "contract IERC20",
        name: "_token",
        type: "address",
      },
    ],
    name: "getERC20MatchingPoolBalance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_donor",
        type: "address",
      },
    ],
    name: "getMatchDonorContribution",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
    ],
    name: "getMatchToken",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "_isTeamA",
        type: "bool",
      },
    ],
    name: "is6v6TeamFull",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_player",
        type: "address",
      },
      {
        internalType: "bool",
        name: "_isTeamA",
        type: "bool",
      },
    ],
    name: "is6v6TeamMember",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isAdmin",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isBlacklisted",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isEntrantInTournament",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isPatron",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "_isTeamA",
        type: "bool",
      },
    ],
    name: "join2v2Team",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "_isTeamA",
        type: "bool",
      },
    ],
    name: "join6v6Team",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchId",
        type: "uint256",
      },
    ],
    name: "joinMatch",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tournamentId",
        type: "uint256",
      },
    ],
    name: "joinTournament",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "matchDonorContributions",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "matches",
    outputs: [
      {
        internalType: "address",
        name: "player1",
        type: "address",
      },
      {
        internalType: "address",
        name: "player2",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "player1Amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "player2Amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "donatedAmount",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "isOpen",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isClosed",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isERC20",
        type: "bool",
      },
      {
        internalType: "contract IERC20",
        name: "token",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "matches2v2",
    outputs: [
      {
        internalType: "address",
        name: "teamAPlayer1",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamAPlayer2",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamBPlayer1",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamBPlayer2",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "player1Amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "donatedAmount",
        type: "uint256",
      },
      {
        internalType: "contract IERC20",
        name: "token",
        type: "address",
      },
      {
        internalType: "bool",
        name: "isERC20",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isOpen",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isClosed",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "matches6v6",
    outputs: [
      {
        internalType: "address",
        name: "player1",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamAPlayer2",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamAPlayer3",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamAPlayer4",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamAPlayer5",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamAPlayer6",
        type: "address",
      },
      {
        internalType: "address",
        name: "player2",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamBPlayer2",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamBPlayer3",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamBPlayer4",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamBPlayer5",
        type: "address",
      },
      {
        internalType: "address",
        name: "teamBPlayer6",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "player1Amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "donatedAmount",
        type: "uint256",
      },
      {
        internalType: "contract IERC20",
        name: "token",
        type: "address",
      },
      {
        internalType: "bool",
        name: "isERC20",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isOpen",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isClosed",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "matchingPool",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "multisigAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextMatchId",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextTournamentId",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_admin",
        type: "address",
      },
    ],
    name: "removeAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_address",
        type: "address",
      },
    ],
    name: "removeBlacklisted",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_multisigAddress",
        type: "address",
      },
    ],
    name: "setMultisigAddress",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchAmount",
        type: "uint256",
      },
      {
        internalType: "contract IERC20",
        name: "_token",
        type: "address",
      },
    ],
    name: "start2v2Match",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_amount",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_token",
        type: "address",
      },
    ],
    name: "start6v6Match",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_matchAmount",
        type: "uint256",
      },
      {
        internalType: "contract IERC20",
        name: "_token",
        type: "address",
      },
    ],
    name: "startMatch",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tournamentId",
        type: "uint256",
      },
    ],
    name: "startTournament",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "tournamentEntrants",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "tournamentMatchingPools",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "tournamentWinners",
    outputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "hasClaimed",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "tournaments",
    outputs: [
      {
        internalType: "uint8",
        name: "winnersPercentage",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "multisigPercentage",
        type: "uint8",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "hasStarted",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "isERC20",
        type: "bool",
      },
      {
        internalType: "bool",
        name: "hasEntryFee",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "numEntrants",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalDonations",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalTokenDonations",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "remainingBalance",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "entryFee",
        type: "uint256",
      },
      {
        internalType: "contract IERC20",
        name: "token",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "withdrawFunds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
];
