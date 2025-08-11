import { NextResponse, NextRequest } from 'next/server';
import { prisma, resetPrismaConnection } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

function isPreparedStmtError(err: unknown) {
    const msg = String(err ?? '');
    return msg.includes('prepared statement') || msg.includes('26000');
}

export async function GET(request: NextRequest) {
    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }
    const doQuery = async () => {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [totalMatches, matchesOpen, matchesCompleted] = await Promise.all([
            prisma.match.count(),
            prisma.match.count({ where: { status: 'OPEN' } }),
            prisma.match.count({ where: { status: 'COMPLETED' } }),
        ]);

        // Total prize paid split by token
        const [{ _sum: sumPrizeEth }, { _sum: sumPrizeMatch }] = await Promise.all([
            prisma.match.aggregate({ where: { status: 'COMPLETED', tokenName: 'ETH' }, _sum: { totalPrize: true } }),
            prisma.match.aggregate({ where: { status: 'COMPLETED', tokenName: 'MATCH' }, _sum: { totalPrize: true } }),
        ]);

        // Average entry fee split by token
        const [{ _avg: avgStakeEth }, { _avg: avgStakeMatch }] = await Promise.all([
            prisma.match.aggregate({ where: { tokenName: 'ETH' }, _avg: { stake: true } }),
            prisma.match.aggregate({ where: { tokenName: 'MATCH' }, _avg: { stake: true } }),
        ]);

        const newMatches24h = await prisma.match.count({ where: { createdAt: { gte: dayAgo } } });

        // Active players 7d: deduplicate creator/player2 addresses
        const lastWeekMatches = await prisma.match.findMany({
            where: { createdAt: { gte: weekAgo } },
            select: { creatorAddress: true, player2Address: true },
        });
        const activeSet = new Set<string>();
        for (const m of lastWeekMatches) {
            if (m.creatorAddress) activeSet.add(m.creatorAddress);
            if (m.player2Address) activeSet.add(m.player2Address);
        }

        return NextResponse.json({
            success: true,
            data: {
                totalMatches,
                matchesOpen,
                matchesCompleted,
                totalPrizePaidEth: sumPrizeEth.totalPrize ?? 0,
                totalPrizePaidMatch: sumPrizeMatch.totalPrize ?? 0,
                avgEntryFeeEth: avgStakeEth.stake ?? 0,
                avgEntryFeeMatch: avgStakeMatch.stake ?? 0,
                newMatches24h,
                activePlayers7d: activeSet.size,
            },
        });
    };

    try {
        return await doQuery();
    } catch (err) {
        if (isPreparedStmtError(err)) {
            await resetPrismaConnection();
            try {
                return await doQuery();
            } catch (err2) {
                return NextResponse.json({ success: false, error: String(err2) }, { status: 500 });
            }
        }
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
} 