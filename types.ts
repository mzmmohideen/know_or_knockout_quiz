
export enum Genre {
  Cuisine = 'Cuisine',
  Mystery = 'Mystery',
  IndianCinema = 'Indian Cinema',
  FamousPersonalities = 'Famous Personalities',
  Science = 'Science',
  Technology = 'Technology',
  History = 'History',
  Geography = 'Geography',
  LogicReasoning = 'Logic & Reasoning',
  GeneralKnowledge = 'General Knowledge',
  BrandsLogos = 'Brands & Logos',
  Archaeology = 'Ancient Indian Archaeology',
  Countries = 'Countries & Continents',
  CurrentAffairs = 'Current Affairs',
  Sports = 'Sports',
  QuantitativeAptitude = 'Quantitative Aptitude'
}

export type QuestionType = 'Visual Decode' | 'Word Scramble' | 'Current Pulse' | 'Odd One Out' | 'Rapid Recall';

export interface Question {
  text: string;
  answer: string;
  genre: Genre;
  type: QuestionType;
  imageUrl?: string;
  isCompleted?: boolean;
}

export interface Player {
  id: number;
  name: string;
  score: number;
  passesLeft: number;
  wrongAnswers: number;
  totalPassesUsed: number;
}

export type GameStatus = 'SETUP' | 'ROUND_START' | 'GENRE_SELECT' | 'ARENA_ACTIVE' | 'OPEN_QUIZ' | 'CHALLENGE_TARGET' | 'CHALLENGE_RESOLVE' | 'CHALLENGE_FINAL' | 'ROUND_END' | 'WINNER';

export interface ChallengeState {
  count: number;
  targetId: number | null;
  history: { targetId: number; result: 'CORRECT' | 'WRONG' | 'PASS' }[];
}

export interface GameState {
  status: GameStatus;
  round: number;
  players: Player[];
  currentPlayerIndex: number;
  selectedGenre: Genre | null;
  questions: Question[];
  activeQuestionIndex: number | null;
  timer: number;
  timerActive: boolean;
  eliminatedPlayerIds: number[];
  isLoading: boolean;
  usedQuestions: Set<string>;
  challengeState?: ChallengeState;
}
