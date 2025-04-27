import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('amount') || '10';
    const category = searchParams.get('category') || '';
    const difficulty = searchParams.get('difficulty') || '';

    const params: Record<string, string> = { amount };

    if (category && category !== 'any') {
        params.category = category;
    }

    if (difficulty && difficulty !== 'any') {
        params.difficulty = difficulty;
    }

    try {
        const response = await axios.get('https://opentdb.com/api.php', { params });

        if (response.data.response_code === 0) {
            // Process the questions to format them for our game
            const questions = response.data.results.map((q: any, index: number) => ({
                id: `q-${index}`,
                category: q.category,
                difficulty: q.difficulty,
                question: q.question,
                correctAnswer: q.correct_answer,
                incorrectAnswers: q.incorrect_answers
            }));

            return NextResponse.json({ questions });
        } else {
            return NextResponse.json(
                { error: 'Failed to fetch questions from the API' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error fetching questions:', error);
        return NextResponse.json(
            { error: 'An error occurred while fetching questions' },
            { status: 500 }
        );
    }
}