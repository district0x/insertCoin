import { NextResponse, NextRequest } from 'next/server';
import { prisma, resetPrismaConnection } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/middleware/rate-limit';

function isPreparedStmtError(err: unknown) {
    const msg = String(err ?? '');
    return msg.includes('prepared statement') || msg.includes('26000');
}

export async function GET() {
    const doQuery = async () => {
        // All-time aggregation of games played (top 5)
        try {
            const grouped = await prisma.match.groupBy({
                by: ['game'],
                where: { game: { not: null } },
                _count: { game: true },
            });
            const entries = grouped
                .filter(g => g.game)
                .map(g => ({ game: g.game as string, count: Number(g._count.game || 0) }));
            entries.sort((a, b) => b.count - a.count);
            const topGames = entries.slice(0, 5);
            return NextResponse.json({ success: true, data: { topGames } });
        } catch (e) {
            // Fallback manual aggregation (all-time)
            const matches = await prisma.match.findMany({
                where: { NOT: { game: null } },
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