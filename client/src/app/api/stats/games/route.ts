import { NextResponse, NextRequest } from 'next/server';
import { prisma, resetPrismaConnection } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

function isPreparedStmtError(err: unknown) {
    const msg = String(err ?? '');
    return msg.includes('prepared statement') || msg.includes('26000');
}

export async function GET() {
    const doQuery = async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Use groupBy if available; fall back to manual aggregation
        try {
            const grouped = await prisma.match.groupBy({
                by: ['game'],
                where: { createdAt: { gte: weekAgo }, game: { not: null } },
                _count: { _all: true },
                orderBy: { _count: { _all: 'desc' } },
                take: 5,
            });
            const topGames = grouped
                .filter(g => g.game)
                .map(g => ({ game: g.game as string, count: g._count._all }));
            return NextResponse.json({ success: true, data: { topGames } });
        } catch (e) {
            // Fallback manual aggregation
            const matches = await prisma.match.findMany({
                where: { createdAt: { gte: weekAgo }, NOT: { game: null } },
                select: { game: true },
            });
            const map = new Map<string, number>();
            for (const m of matches) {
                const key = (m.game || '').trim();
                if (!key) continue;
                map.set(key, (map.get(key) || 0) + 1);
            }
            const topGames = Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([game, count]) => ({ game, count }));
            return NextResponse.json({ success: true, data: { topGames } });
        }
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