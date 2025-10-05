"use client";

import * as React from "react";
import Link from "next/link";

export default function FaqPage() {
    return (
        <div className="container mx-auto px-4 py-10">
            <h1 className="text-3xl font-bold mb-6">FAQs</h1>

            <div className="space-y-8 text-gray-200">
                <section>
                    <h2 className="text-xl font-semibold">How do I create a match?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>
                            Join our discord. Complete our onboarding process and verify your wallet and account.
                            In game lobby use /create-match to interact with our matchmaking system.
                            /create-match command, choose game, platform, token(ETH or MATCH), and amount.
                            A notification that a new MATCH has been created will inform lobby members. Anyone in the lobby can join the match.
                            Player 1 can create the match following instructions provided in the room lobby.
                            After the match is created, player 2 can join the match following instructions provided in the room lobby.

                        </p>

                        <p>
                            For ETH matches created via Discord, the USD amount is capped at $200.
                        </p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">How do I join a match?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>Join the match lobby channel in Discord. On the match page, connect your wallet and click Join to escrow your stake to the contract.</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">What are the payout splits?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>Winner: 80% of prize pool</p>
                        <p>Platform/Contract fee: 15% of prize pool  - These funds will be allocated to for use in Insert Coin community tournaments. All funds received from player matches will be added to the prize pool of all Insert Coin tournaments.</p>
                        <p>Multisig: 5% of prize pool - This wallet is used to donate to player matches & to distribute platform fee to the Insert Coin dev team.</p>
                        <p>Splits apply to the total prize pool (stakes + donations).</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">What tokens can I use?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p><strong>ETH</strong>: Use ETH to create, join, and donate to matches.</p>
                        <p><strong>MATCH</strong>: Utility-only in-app token with no real-world value. It can be used to create/join matches (when the lobby is set to MATCH) and donate to prize pools.</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">What can I do with MATCH tokens?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>1) Vote on tournament games and sponsorship ideas</p>
                        <p>2) Create and join game mode matches (1v1, 2v2, 6v6)</p>
                        <p>3) Donate to matches to boost prize pools</p>
                        <p className="italic">MATCH is for utility/engagement only; it has no monetary value.</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">What happens when I donate to a match?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>Anyone can donate to increase the prize pool. For ETH matches, you enter a USD amount that converts to ETH automatically; for MATCH, enter the token amount directly. After confirmation, the prize pool and payouts reflect the new total.</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">What happens if players don’t finish a match?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>Because funds are locked on-chain, refunds are not possible.</p>
                        <p>Any player that commits to the match in the Discord lobby and does not complete it will be banned indefinitely.</p>
                        <p>A match will not be created on-chain until this agreement is completed by both players in Discord (typing "Start").</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">What is the full match lifecycle?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>Create lobby in Discord → players join room → any participant clicks Create Match and types "Start" → website pre-fills details → creator submits on-chain (escrow) → opponent joins (escrow) → match is played → winner is selected → contract distributes prize (80/15/5).</p>
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-semibold">Are tournaments available?</h2>
                    <div className="mt-2 space-y-2 text-sm text-gray-300">
                        <p>Tournaments are coming soon. Updates will be provided in Discord.</p>
                    </div>
                </section>
            </div>
        </div>
    );
} 