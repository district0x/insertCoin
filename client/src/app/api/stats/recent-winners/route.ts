import { NextResponse, NextRequest } from 'next/server';
import { prisma, resetPrismaConnection } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

function isPreparedStmtError(err: unknown) {
    const msg = String(err ?? '');
    return msg.includes('prepared statement') || msg.includes('26000');
}

export async function GET() {
    const doQuery = async () => {
        const recent = await prisma.match.findMany({
            where: { status: 'COMPLETED', winnerAddress: { not: null } },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
                matchId: true,
                game: true,
                winnerAddress: true,
                creatorAddress: true,
                player2Address: true,
                creatorName: true,
                player2Name: true,
                totalPrize: true,
                tokenName: true,
                updatedAt: true,
            },
        });

        const items = recent.map((m) => {
            let winnerName: string | null = null;
            if (m.winnerAddress && m.creatorAddress && m.winnerAddress === m.creatorAddress) {
                winnerName = (m as any).creatorName || null;
            } else if (m.winnerAddress && m.player2Address && m.winnerAddress === m.player2Address) {
                winnerName = (m as any).player2Name || null;
            }
            return {
                matchId: m.matchId,
                game: m.game,
                winnerAddress: m.winnerAddress,
                winnerName,
                amount: m.totalPrize,
                tokenName: m.tokenName,
                completedAt: m.updatedAt,
            };
        });

        return NextResponse.json({ success: true, data: { winners: items } });
    };

    try {
        return await doQuery();
    } catch (err) {
        if (isPreparedStmtError(err)) {
            await resetPrismaConnection();
            try { return await doQuery(); } catch (err2) {
                return NextResponse.json({ success: false, error: String(err2) }, { status: 500 });
            }
        }
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
} 