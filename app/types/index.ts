// Game related types
export interface Question {
    id: string;
    category: string;
    difficulty: string;
    question: string;
    correctAnswer: string;
    incorrectAnswers: string[];
}

export interface Player {
    id: string;
    name: string;
    score: number;
    eliminated?: boolean;
    walletAddress?: string;
}

export interface GameRoom {
    id: string;
    hostId: string;
    players: Player[];
    status: 'waiting' | 'in-progress' | 'completed';
    settings: {
        category?: string;
        difficulty?: string;
        questionCount: number;
        suddenDeath?: boolean; // New field for game mode
        timerDuration?: number; // New field for timer setting
    };
}

export interface GameState {
    currentQuestionIndex: number;
    questions: Question[];
    timeLeft: number;
    playerAnswers: Record<string, string>;
}

export interface GameSettings {
    category?: string;
    difficulty?: string;
    questionCount: number;
    suddenDeath?: boolean;
    timerDuration?: number;
}