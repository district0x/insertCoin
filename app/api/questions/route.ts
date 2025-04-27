import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('amount') || '10';
    const category = searchParams.get('category') || '';
    const difficulty = searchParams.get('difficulty') || '';

    console.log(`FETCHING QUESTIONS: amount=${amount}, category=${category}, difficulty=${difficulty}`);

    const params: Record<string, string> = { amount };

    if (category && category !== 'any') {
        params.category = category;
    }

    if (difficulty && difficulty !== 'any') {
        params.difficulty = difficulty;
    }

    try {
        // Try to fetch from Open Trivia DB
        const response = await axios.get('https://opentdb.com/api.php', { params });
        console.log(`API Response status: ${response.status}, questions count: ${response.data.results?.length || 0}`);

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
            console.error('Error from OpenTriviaDB API:', response.data);
            return NextResponse.json(
                { error: 'Failed to fetch questions from the API', mockResponse: true, questions: generateMockQuestions(parseInt(amount)) },
                { status: 200 } // Return 200 with mock questions instead of 400
            );
        }
    } catch (error) {
        console.error('Error fetching questions:', error);
        // Return mock questions as a fallback
        return NextResponse.json(
            { error: 'An error occurred while fetching questions', mockResponse: true, questions: generateMockQuestions(parseInt(amount)) },
            { status: 200 } // Return 200 with mock questions instead of 500
        );
    }
}

// Function to generate mock questions if the API fails
function generateMockQuestions(amount: number = 10) {
    const mockQuestions = [
        {
            id: 'q-1',
            category: 'General Knowledge',
            difficulty: 'easy',
            question: 'What is the capital of France?',
            correctAnswer: 'Paris',
            incorrectAnswers: ['London', 'Berlin', 'Madrid']
        },
        {
            id: 'q-2',
            category: 'Science',
            difficulty: 'medium',
            question: 'What is the chemical symbol for gold?',
            correctAnswer: 'Au',
            incorrectAnswers: ['Ag', 'Fe', 'Cu']
        },
        {
            id: 'q-3',
            category: 'Geography',
            difficulty: 'medium',
            question: 'Which is the longest river in the world?',
            correctAnswer: 'Nile',
            incorrectAnswers: ['Amazon', 'Mississippi', 'Yangtze']
        },
        {
            id: 'q-4',
            category: 'History',
            difficulty: 'hard',
            question: 'In which year did World War II end?',
            correctAnswer: '1945',
            incorrectAnswers: ['1939', '1942', '1944']
        },
        {
            id: 'q-5',
            category: 'Entertainment',
            difficulty: 'easy',
            question: 'Who played Iron Man in the Marvel Cinematic Universe?',
            correctAnswer: 'Robert Downey Jr.',
            incorrectAnswers: ['Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo']
        },
        {
            id: 'q-6',
            category: 'Sports',
            difficulty: 'medium',
            question: 'Which country won the FIFA World Cup in 2018?',
            correctAnswer: 'France',
            incorrectAnswers: ['Brazil', 'Germany', 'Argentina']
        },
        {
            id: 'q-7',
            category: 'Technology',
            difficulty: 'easy',
            question: 'What company makes the iPhone?',
            correctAnswer: 'Apple',
            incorrectAnswers: ['Samsung', 'Google', 'Microsoft']
        },
        {
            id: 'q-8',
            category: 'Food & Drink',
            difficulty: 'medium',
            question: 'What is the main ingredient in guacamole?',
            correctAnswer: 'Avocado',
            incorrectAnswers: ['Tomato', 'Onion', 'Lime']
        },
        {
            id: 'q-9',
            category: 'Music',
            difficulty: 'hard',
            question: 'Which band released the album "Dark Side of the Moon"?',
            correctAnswer: 'Pink Floyd',
            incorrectAnswers: ['The Beatles', 'Led Zeppelin', 'The Rolling Stones']
        },
        {
            id: 'q-10',
            category: 'Literature',
            difficulty: 'medium',
            question: 'Who wrote "To Kill a Mockingbird"?',
            correctAnswer: 'Harper Lee',
            incorrectAnswers: ['Ernest Hemingway', 'Mark Twain', 'J.D. Salinger']
        },
        {
            id: 'q-11',
            category: 'Science',
            difficulty: 'hard',
            question: 'What is the smallest prime number?',
            correctAnswer: '2',
            incorrectAnswers: ['1', '3', '0']
        },
        {
            id: 'q-12',
            category: 'Geography',
            difficulty: 'hard',
            question: 'What is the capital of Australia?',
            correctAnswer: 'Canberra',
            incorrectAnswers: ['Sydney', 'Melbourne', 'Perth']
        }
    ];

    // Return the requested number of questions, or all if amount > available
    return mockQuestions.slice(0, Math.min(amount, mockQuestions.length));
}