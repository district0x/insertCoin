import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        // Read game results file
        const dataDir = path.join(process.cwd(), 'data');
        const resultsFile = path.join(dataDir, 'game-results.json');

        // Check if the file exists
        if (!fs.existsSync(resultsFile)) {
            return NextResponse.json({ results: [] });
        }

        // Read and parse the file
        const data = fs.readFileSync(resultsFile, 'utf8');
        const results = JSON.parse(data);

        // Sort results by timestamp (most recent first)
        results.sort((a, b) => {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        // Return only the most recent 20 results
        return NextResponse.json({
            results: results.slice(0, 20),
            totalGames: results.length
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard data' },
            { status: 500 }
        );
    }
}