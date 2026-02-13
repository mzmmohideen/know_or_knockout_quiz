
import React, { useState, useEffect, useRef } from 'react';
import { 
  Player, 
  Genre, 
  GameStatus, 
  GameState, 
  Question
} from './types';
import { fetchAllQuestionsForGenre } from './geminiService';

const MAX_ROUNDS = 10;
const ROUND_TIME = 30;
const POINTS_CORRECT = 10;
const POINTS_WRONG = -10;
const POINTS_PASS = -5; // Updated to match rulebook: Each pass costs -5 points
const OPEN_QUIZ_CORRECT = 10;
const OPEN_QUIZ_WRONG = -5;

const GENRE_IMAGES: Record<string, string> = {
  [Genre.Cuisine]: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400",
  [Genre.Mystery]: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&q=80&w=400",
  [Genre.IndianCinema]: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=400",
  [Genre.FamousPersonalities]: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400",
  [Genre.Science]: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80&w=400",
  [Genre.Technology]: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400",
  [Genre.History]: "https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&q=80&w=400",
  [Genre.Geography]: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=400",
  [Genre.LogicReasoning]: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=400",
  [Genre.GeneralKnowledge]: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400",
  [Genre.BrandsLogos]: "https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&q=80&w=400",
  [Genre.Archaeology]: "https://images.unsplash.com/photo-1608408843596-b3119736057c?auto=format&fit=crop&q=80&w=400",
  [Genre.Countries]: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=400",
  [Genre.CurrentAffairs]: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&q=80&w=400",
  [Genre.Sports]: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400",
  [Genre.QuantitativeAptitude]: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&get=80&w=400"
};

const DEFAULT_PLAYERS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  name: `Player ${i + 1}`,
  score: 0,
  passesLeft: 2,
  wrongAnswers: 0,
  totalPassesUsed: 0,
}));

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    status: 'SETUP',
    round: 1,
    players: DEFAULT_PLAYERS,
    currentPlayerIndex: 0,
    selectedGenre: null,
    questions: [],
    activeQuestionIndex: null,
    timer: ROUND_TIME,
    timerActive: false,
    eliminatedPlayerIds: [],
    isLoading: false,
    usedQuestions: new Set<string>(),
  });

  const [openQuizAttempts, setOpenQuizAttempts] = useState<Set<number>>(new Set());
  const [revealAnswer, setRevealAnswer] = useState<{ visible: boolean, answer: string } | null>(null);
  const [flippingGenre, setFlippingGenre] = useState<Genre | null>(null);
  const [flippingQuestionIdx, setFlippingQuestionIdx] = useState<number | null>(null);
  const [hostAnswerRevealed, setHostAnswerRevealed] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (gameState.timer === 0 && gameState.timerActive) {
      handleTimerExpiry();
    }
  }, [gameState.timer, gameState.timerActive]);

  useEffect(() => {
    if (gameState.timerActive && gameState.timer > 0) {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.timer <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return { ...prev, timer: 0, timerActive: false };
          }
          return { ...prev, timer: prev.timer - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState.timerActive, gameState.timer]);

  const handleTimerExpiry = () => {
    if (gameState.status === 'ARENA_ACTIVE') {
      const player = gameState.players[gameState.currentPlayerIndex];
      updateScore(player.id, POINTS_WRONG, true);
      setGameState(prev => ({ ...prev, status: 'OPEN_QUIZ', timerActive: false }));
    } else if (gameState.status === 'CHALLENGE_RESOLVE') {
      resolveChallenge('WRONG');
    }
  };

  const selectGenre = async (genre: Genre) => {
    setFlippingGenre(genre);
    
    setTimeout(async () => {
      setGameState(prev => ({ ...prev, isLoading: true, selectedGenre: genre }));
      try {
        const qs = await fetchAllQuestionsForGenre(genre, gameState.usedQuestions);
        const availableQs = qs.filter(q => !gameState.usedQuestions.has(q.text));
        
        setGameState(prev => ({ 
          ...prev, 
          questions: availableQs.length > 0 ? availableQs : qs,
          status: 'ARENA_ACTIVE', 
          isLoading: false,
          activeQuestionIndex: null,
          timer: ROUND_TIME,
          timerActive: false
        }));
        setFlippingGenre(null);
      } catch (err) {
        setGameState(prev => ({ ...prev, isLoading: false }));
        setFlippingGenre(null);
      }
    }, 700);
  };

  const expandQuestion = (index: number) => {
    if (gameState.activeQuestionIndex !== null || flippingQuestionIdx !== null) return;
    
    setFlippingQuestionIdx(index);
    setHostAnswerRevealed(false);

    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        activeQuestionIndex: index,
        timer: ROUND_TIME,
        timerActive: true 
      }));
      setFlippingQuestionIdx(null);
    }, 800);
  };

  const goBackToGenres = () => {
    setGameState(prev => ({
      ...prev,
      status: 'ROUND_START',
      selectedGenre: null,
      questions: [],
      activeQuestionIndex: null
    }));
  };

  const updateScore = (id: number, delta: number, isWrong: boolean = false) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === id ? { ...p, score: p.score + delta, wrongAnswers: isWrong ? p.wrongAnswers + 1 : p.wrongAnswers } : p
      )
    }));
  };

  const nextTurn = () => {
    setOpenQuizAttempts(new Set());
    setHostAnswerRevealed(false);
    setIsActionPending(false);
    setGameState(prev => {
      let nextIndex = prev.currentPlayerIndex + 1;
      
      if (nextIndex >= prev.players.length) {
        return {
          ...prev,
          status: 'ROUND_END',
          timerActive: false
        };
      }

      return {
        ...prev,
        currentPlayerIndex: nextIndex,
        status: 'ROUND_START',
        questions: [],
        selectedGenre: null,
        activeQuestionIndex: null,
        timer: ROUND_TIME,
        timerActive: false,
        challengeState: undefined
      };
    });
  };

  const proceedToNextRound = () => {
    setGameState(prev => {
      const nextRound = prev.round + 1;
      const isGameOver = nextRound > MAX_ROUNDS;

      return {
        ...prev,
        currentPlayerIndex: 0,
        round: nextRound,
        status: isGameOver ? 'WINNER' : 'ROUND_START',
        questions: [],
        selectedGenre: null,
        activeQuestionIndex: null,
        timer: ROUND_TIME,
        timerActive: false,
        eliminatedPlayerIds: [],
        challengeState: undefined
      };
    });
  };

  const finishTournament = () => {
    setGameState(prev => ({ ...prev, status: 'WINNER' }));
  };

  const handleAction = (type: 'CORRECT' | 'WRONG' | 'PASS' | 'CHALLENGE') => {
    if (isActionPending) return;
    const qIdx = gameState.activeQuestionIndex;
    if (qIdx === null) return;

    setIsActionPending(true);
    const player = gameState.players[gameState.currentPlayerIndex];
    const qText = gameState.questions[qIdx].text;

    setGameState(prev => ({ ...prev, usedQuestions: new Set([...prev.usedQuestions, qText]) }));

    if (type === 'CORRECT') {
      updateScore(player.id, POINTS_CORRECT);
      nextTurn();
    } else if (type === 'WRONG') {
      updateScore(player.id, POINTS_WRONG, true);
      setGameState(prev => ({ ...prev, status: 'OPEN_QUIZ', timerActive: false }));
      setIsActionPending(false);
    } else if (type === 'PASS') {
      if (player.passesLeft > 0) {
        updateScore(player.id, POINTS_PASS); 
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === player.id ? { ...p, passesLeft: p.passesLeft - 1, totalPassesUsed: p.totalPassesUsed + 1 } : p),
          status: 'OPEN_QUIZ',
          timerActive: false
        }));
        setIsActionPending(false);
      } else {
        setIsActionPending(false);
      }
    } else if (type === 'CHALLENGE') {
      setGameState(prev => ({
        ...prev,
        status: 'CHALLENGE_TARGET',
        challengeState: { count: 0, targetId: null, history: [] },
        timerActive: false
      }));
      setIsActionPending(false);
    }
  };

  const handleChallengeTarget = (targetId: number) => {
    setGameState(prev => ({
      ...prev,
      status: 'CHALLENGE_RESOLVE',
      challengeState: {
        ...prev.challengeState!,
        targetId: targetId
      },
      timer: ROUND_TIME, 
      timerActive: true
    }));
  };

  const resolveChallenge = (targetResult: 'CORRECT' | 'WRONG' | 'PASS') => {
    if (isActionPending) return;
    setIsActionPending(true);

    setGameState(prev => {
      const challengerIdx = prev.currentPlayerIndex;
      const targetId = prev.challengeState?.targetId;
      
      if (targetId === null || targetId === undefined) {
        setIsActionPending(false);
        return prev;
      }

      const challengeCount = prev.challengeState!.count + 1;
      const challenger = prev.players[challengerIdx];
      const target = prev.players[targetId];
      
      let updatedPlayers = [...prev.players];

      if (targetResult === 'CORRECT') {
        const targetGain = challengeCount === 2 ? 20 : 10;
        updatedPlayers = updatedPlayers.map(p => {
          if (p.id === target.id) return { ...p, score: p.score + targetGain };
          if (p.id === challenger.id) return { ...p, score: p.score - 10 };
          return p;
        });
        
        let nextIndex = prev.currentPlayerIndex + 1;
        setIsActionPending(false);
        if (nextIndex >= prev.players.length) {
          return {
            ...prev,
            players: updatedPlayers,
            status: 'ROUND_END',
            timerActive: false,
            challengeState: undefined
          };
        }
        return {
          ...prev,
          players: updatedPlayers,
          currentPlayerIndex: nextIndex,
          status: 'ROUND_START',
          questions: [],
          selectedGenre: null,
          activeQuestionIndex: null,
          timer: ROUND_TIME,
          timerActive: false,
          challengeState: undefined
        };
      } else if (targetResult === 'WRONG') {
        updatedPlayers = updatedPlayers.map(p => {
          if (p.id === target.id) return { ...p, score: p.score - 10, wrongAnswers: p.wrongAnswers + 1 };
          if (p.id === challenger.id) return { ...p, score: p.score + 10 };
          return p;
        });

        setIsActionPending(false);
        return {
          ...prev,
          players: updatedPlayers,
          status: 'CHALLENGE_RESOLVE',
          timerActive: false,
          challengeState: {
            ...prev.challengeState!,
            targetId: null,
            count: challengeCount,
            history: [...prev.challengeState!.history, { targetId: target.id, result: 'WRONG' }]
          }
        };
      } else if (targetResult === 'PASS') {
        if (target.passesLeft > 0) {
          updatedPlayers = updatedPlayers.map(p => {
            if (p.id === target.id) return { ...p, passesLeft: p.passesLeft - 1, totalPassesUsed: p.totalPassesUsed + 1, score: p.score - 5 };
            if (p.id === challenger.id) return { ...p, score: p.score + 5 };
            return p;
          });

          setIsActionPending(false);
          return {
            ...prev,
            players: updatedPlayers,
            status: 'CHALLENGE_RESOLVE',
            timerActive: false,
            challengeState: {
              ...prev.challengeState!,
              targetId: null,
              count: challengeCount,
              history: [...prev.challengeState!.history, { targetId: target.id, result: 'PASS' }]
            }
          };
        }
      }
      setIsActionPending(false);
      return prev;
    });
  };

  const resolveFinalChallenger = (isCorrect: boolean) => {
    if (isActionPending) return;
    setIsActionPending(true);
    const challenger = gameState.players[gameState.currentPlayerIndex];
    const challengeCount = gameState.challengeState!.count;

    if (isCorrect) {
      updateScore(challenger.id, 10 + (challengeCount * 10));
      nextTurn();
    } else {
      updateScore(challenger.id, -10, true);
      nextTurn();
    }
  };

  const handleOpenQuiz = (pId: number, isCorrect: boolean) => {
    if (isActionPending) return;
    setIsActionPending(true);
    if (isCorrect) {
      updateScore(pId, OPEN_QUIZ_CORRECT);
      nextTurn();
    } else {
      updateScore(pId, OPEN_QUIZ_WRONG, true);
      setOpenQuizAttempts(prev => new Set([...prev, pId]));
      setIsActionPending(false);
    }
  };

  const showReveal = () => {
    const qIdx = gameState.activeQuestionIndex;
    if (qIdx !== null) {
      const q = gameState.questions[qIdx];
      setRevealAnswer({ visible: true, answer: q.answer });
    }
  };

  if (!isLoggedIn) return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
  if (gameState.status === 'SETUP') return <SetupScreen onStart={(players) => setGameState(prev => ({ ...prev, players, status: 'ROUND_START' }))} />;
  if (gameState.status === 'WINNER') return <WinnerScreen players={gameState.players} />;

  const current = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col md:flex-row p-2 md:p-3 gap-3 overflow-hidden">
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .flip-transition { transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      {revealAnswer?.visible && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in">
          <div className="max-w-md w-full bg-zinc-900 border-2 border-red-600 p-6 rounded-[1rem] text-center shadow-2xl">
            <span className="text-[7px] font-black text-red-600 uppercase tracking-widest mb-1 block">ANSWER KEY</span>
            <p className="text-base font-bold text-white italic mb-5">"{revealAnswer.answer}"</p>
            <button onClick={() => { setRevealAnswer(null); nextTurn(); }} className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2 rounded-full uppercase text-[8px]">End Turn</button>
          </div>
        </div>
      )}

      {gameState.status === 'ROUND_END' && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in duration-300">
           <div className="max-w-lg w-full bg-zinc-900 border-4 border-yellow-500 p-8 rounded-[2rem] text-center shadow-[0_0_50px_rgba(234,179,8,0.3)]">
              <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.5em] mb-2 block">ROUND {gameState.round} COMPLETE</span>
              <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-8 leading-none">Intermission</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={proceedToNextRound} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl text-sm uppercase transition-all hover:scale-105 active:scale-95 shadow-lg">Next Round 🥊</button>
                  <button onClick={finishTournament} className="bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl text-sm uppercase transition-all hover:scale-105 active:scale-95 border border-zinc-700">Finish & Results 🏆</button>
                  <button onClick={() => setShowLeaderboard(true)} className="col-span-full bg-zinc-700 hover:bg-zinc-600 text-white font-black py-3 rounded-xl text-sm uppercase transition-all active:scale-95 mt-2">Leaderboard 📊</button>
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-800">
                  <p className="text-[8px] font-bold text-zinc-500 uppercase italic">Carrying scores to next stage...</p>
              </div>
           </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in">
          <div className="max-w-md w-full bg-zinc-900 border-2 border-yellow-500 p-8 rounded-[2rem] shadow-2xl">
            <h3 className="text-[12px] font-black text-yellow-500 uppercase tracking-[0.4em] text-center mb-6">TOP FIGHTERS</h3>
            <div className="space-y-4 mb-8">
              {[...gameState.players].sort((a,b) => b.score - a.score).slice(0, 3).map((p, idx) => (
                <div key={p.id} className="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-4">
                    <span className={`text-xl font-black ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-zinc-400' : 'text-amber-700'}`}>#{idx + 1}</span>
                    <span className="text-sm font-black text-white uppercase">{p.name}</span>
                  </div>
                  <span className="text-xl font-black text-white italic">{p.score}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowLeaderboard(false)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest">Back to Ring</button>
          </div>
        </div>
      )}

      <aside className="w-full md:w-52 space-y-2 shrink-0">
        <div className="bg-red-700 p-2 rounded-xl shadow-xl border-b-4 border-red-900">
          <h1 className="text-sm font-black italic uppercase leading-none tracking-tighter text-white">Know or Knockout</h1>
          <div className="mt-1 flex justify-between items-center text-[5px] font-bold opacity-80 uppercase border-t border-red-600 pt-1 text-red-100">
            <span>ROUND {gameState.round}</span>
            <span>PLAYER {gameState.currentPlayerIndex + 1}</span>
          </div>
        </div>
        <Scoreboard players={gameState.players} currentIndex={gameState.currentPlayerIndex} isArenaSpecial={gameState.status === 'OPEN_QUIZ' || gameState.status.startsWith('CHALLENGE')} />
      </aside>

      <main className="flex-1 flex flex-col gap-2 relative">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-[1.2rem] flex-1 relative flex flex-col shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] pointer-events-none rounded-full"></div>
          
          <div className="flex justify-between items-end mb-3 border-b border-zinc-800 pb-2 relative z-10">
            <div className="flex-1">
              <span className="text-[6px] font-black text-red-500 uppercase tracking-widest block mb-0.5">
                {gameState.status.includes('CHALLENGE') ? 'CHALLENGE RING' : gameState.status === 'OPEN_QUIZ' ? 'OPEN STRIKE' : 'FIGHTER READY'}
              </span>
              <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter truncate text-white">
                {gameState.status.includes('CHALLENGE') ? `FIGHT: ${current.name}` : gameState.status === 'OPEN_QUIZ' ? 'OPEN STRIKE' : current.name}
              </h2>
            </div>
            {gameState.timerActive && (
              <div className="text-right">
                <div className={`text-2xl font-black tabular-nums leading-none ${gameState.timer <= 10 ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`}>
                  :{gameState.timer.toString().padStart(2, '0')}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 relative z-10 custom-scrollbar">
            {gameState.isLoading && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-[7px] font-black uppercase text-red-600 tracking-widest">LOADING RING...</span>
              </div>
            )}

            {!gameState.isLoading && gameState.status === 'ROUND_START' && (
              <div className="h-full">
                <div className="mb-4 text-center">
                  <span className="text-[7px] font-black text-red-600 uppercase tracking-[0.3em]">SELECT YOUR BOUT</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.values(Genre).map(g => (
                    <div key={g} className="perspective-1000 h-28 md:h-36">
                      <button 
                        onClick={() => !flippingGenre && selectGenre(g)}
                        className={`w-full h-full relative preserve-3d flip-transition text-left group ${flippingGenre === g ? 'rotate-y-180' : ''}`}
                      >
                        <div className="absolute inset-0 backface-hidden rounded-xl overflow-hidden shadow-lg border-2 border-zinc-800 group-hover:border-red-600 transition-all group-hover:-translate-y-1">
                          <img src={GENRE_IMAGES[g]} alt={g} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-3 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <span className="text-[5px] font-black text-white/50 uppercase tracking-widest">CATEGORY</span>
                              <div className="w-1.5 h-1.5 rounded-full bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                            <span className="text-[9px] md:text-[11px] font-black italic uppercase leading-none tracking-tighter text-white drop-shadow-md break-words pr-2">{g}</span>
                            <div className="flex justify-end">
                               <span className="text-[4px] font-bold text-white/40 group-hover:text-red-500 transition-colors uppercase italic tracking-widest">ENTER RING →</span>
                            </div>
                          </div>
                        </div>
                        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-red-600 border-2 border-red-400 p-3 rounded-xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mb-2"></div>
                          <span className="text-[8px] font-black text-white uppercase italic tracking-tighter">FIGHT LOCKING...</span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!gameState.isLoading && (gameState.status === 'ARENA_ACTIVE' || gameState.status === 'OPEN_QUIZ' || gameState.status.startsWith('CHALLENGE')) && (
              <div className="space-y-4 h-full flex flex-col">
                {gameState.activeQuestionIndex === null ? (
                    <div className="flex flex-col items-center justify-center h-full gap-8 animate-in zoom-in">
                        <div className="flex flex-wrap justify-center gap-3 items-center">
                            {gameState.questions.map((q, idx) => (
                                <div key={idx} className="perspective-1000 w-24 h-24 md:w-32 md:h-32">
                                    <button 
                                        onClick={() => expandQuestion(idx)} 
                                        className={`w-full h-full relative preserve-3d flip-transition text-center ${flippingQuestionIdx === idx ? 'rotate-y-180' : ''}`}
                                    >
                                        <div className="absolute inset-0 backface-hidden bg-zinc-800 border-2 border-zinc-700 hover:border-red-600 hover:bg-zinc-700 flex flex-col items-center justify-center p-2 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 group">
                                            <span className="text-[5px] font-black text-red-500 uppercase mb-0.5 tracking-tighter opacity-50 group-hover:opacity-100">STRIKE #{idx + 1}</span>
                                            <span className="text-[8px] md:text-[10px] font-black italic uppercase leading-tight tracking-tighter text-white group-hover:text-red-500 transition-colors">{q.type}</span>
                                            <div className="mt-2 text-[4px] font-bold text-zinc-600 uppercase italic opacity-0 group-hover:opacity-100 transition-opacity">Click to Reveal</div>
                                        </div>
                                        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-zinc-950 border-2 border-red-600 p-3 rounded-xl flex flex-col items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                                            <div className="text-[6px] font-black text-red-600 uppercase mb-1 animate-pulse">REVEALING BOUT</div>
                                            <div className="w-4 h-4 border-b-2 border-red-600 rounded-full animate-spin"></div>
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button 
                          onClick={goBackToGenres}
                          className="text-[7px] font-black text-zinc-500 hover:text-red-500 uppercase tracking-[0.3em] flex items-center gap-2 border border-zinc-800 px-4 py-2 rounded-full transition-all hover:border-red-500/30"
                        >
                          <span className="text-[10px]">←</span> RESELECT GENRE
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col">
                         {gameState.questions.map((q, idx) => {
                            if (idx !== gameState.activeQuestionIndex) return null;
                            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                            return (
                                <div key={idx} className="flex-1 flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-500">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="bg-red-600 text-[5px] font-black px-1.5 py-0.5 rounded-full uppercase">{q.type}</span>
                                                <span className="text-zinc-500 text-[5px] font-bold uppercase">{gameState.selectedGenre}</span>
                                            </div>
                                            
                                            {q.type === 'Visual Decode' ? (
                                                <div className="space-y-3">
                                                    {q.imageUrl ? (
                                                        <div className="mx-auto max-w-[320px] rounded-xl overflow-hidden border-2 border-red-600 shadow-2xl relative">
                                                            <img src={q.imageUrl} alt="Visual Evidence" className="w-full h-auto object-cover" />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-yellow-900/10 border border-yellow-900/30 p-3 rounded-lg text-center">
                                                            <span className="text-[6px] font-black text-yellow-600 uppercase block mb-1">HOST: SHOW RELEVANT PICTURE FOR</span>
                                                            <p className="text-[8px] text-zinc-400 italic">Visual clue required for this question type</p>
                                                        </div>
                                                    )}
                                                    <h3 className="text-sm md:text-base font-black leading-tight text-white italic text-center">{q.text}</h3>
                                                </div>
                                            ) : (
                                                <h3 className="text-sm md:text-base font-black leading-tight text-white">{q.text}</h3>
                                            )}
                                            
                                            <div className="bg-zinc-950/50 border border-zinc-800 p-2 rounded-lg flex flex-col items-start gap-1">
                                                <span className="text-[4px] font-black text-zinc-600 uppercase block">HOST VIEW ONLY</span>
                                                {hostAnswerRevealed ? (
                                                  <p className="text-[9px] font-bold text-zinc-400 italic">"{q.answer}"</p>
                                                ) : (
                                                  <button 
                                                    onClick={() => setHostAnswerRevealed(true)}
                                                    className="text-[6px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest border border-red-900/30 px-2 py-1 rounded bg-red-900/5 transition-all"
                                                  >
                                                    Reveal Answer for Host
                                                  </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto grid grid-cols-2 md:grid-cols-4 gap-1.5 pt-3 border-t border-zinc-800 relative z-50">
                                        {gameState.status === 'ARENA_ACTIVE' && (
                                            <>
                                                <button disabled={isActionPending} onClick={() => handleAction('CORRECT')} className="bg-green-600 py-3 rounded-lg font-black uppercase text-[7px] active:translate-y-0.5 shadow-sm transition-colors hover:bg-green-500 disabled:opacity-50">Correct (+10)</button>
                                                <button disabled={isActionPending} onClick={() => handleAction('WRONG')} className="bg-red-600 py-3 rounded-lg font-black uppercase text-[7px] active:translate-y-0.5 shadow-sm transition-colors hover:bg-red-500 disabled:opacity-50">Wrong (-10)</button>
                                                <button 
                                                  disabled={currentPlayer.passesLeft === 0 || isActionPending}
                                                  onClick={() => handleAction('PASS')} 
                                                  className={`py-3 rounded-lg font-black uppercase text-[7px] active:translate-y-0.5 shadow-sm transition-colors ${currentPlayer.passesLeft > 0 ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-900 text-zinc-700 cursor-not-allowed border border-zinc-800'} disabled:opacity-50`}
                                                >
                                                  {currentPlayer.passesLeft > 0 ? `Pass (-5) [${currentPlayer.passesLeft} Left]` : 'No Passes Left'}
                                                </button>
                                                <button disabled={isActionPending} onClick={() => handleAction('CHALLENGE')} className="bg-white text-black py-3 rounded-lg font-black uppercase text-[7px] active:translate-y-0.5 shadow-sm transition-colors hover:bg-zinc-200 disabled:opacity-50">Challenge</button>
                                            </>
                                        )}

                                        {gameState.status === 'OPEN_QUIZ' && (
                                            <div className="col-span-full space-y-2 animate-in fade-in">
                                                <h3 className="text-center text-[6px] font-black text-yellow-500 uppercase tracking-widest">OPEN ARENA: ANYONE CAN ANSWER (+10)</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
                                                    {gameState.players.map(p => {
                                                        const hasFailed = openQuizAttempts.has(p.id);
                                                        const isCurrent = p.id === gameState.currentPlayerIndex;
                                                        const isEliminated = gameState.eliminatedPlayerIds.includes(p.id);
                                                        const canTry = !hasFailed && !isCurrent && !isEliminated && !isActionPending;
                                                        return (
                                                            <div key={p.id} className={`bg-zinc-800/50 p-1 rounded-lg text-center border transition-all ${!canTry ? 'opacity-20 border-zinc-800' : 'border-zinc-700'}`}>
                                                                <span className="text-[5px] font-black uppercase text-zinc-500 block truncate">{p.name}</span>
                                                                <div className="flex gap-1 mt-1">
                                                                    <button disabled={!canTry} onClick={() => handleOpenQuiz(p.id, true)} className="flex-1 bg-green-900/40 hover:bg-green-600 text-[5px] font-black py-1 rounded uppercase transition-all disabled:cursor-not-allowed">Y</button>
                                                                    <button disabled={!canTry} onClick={() => handleOpenQuiz(p.id, false)} className="flex-1 bg-red-900/40 hover:bg-red-600 text-[5px] font-black py-1 rounded uppercase transition-all disabled:cursor-not-allowed">N</button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <button onClick={showReveal} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-2 rounded-lg text-[6px] font-black uppercase tracking-widest transition-all">Reveal Answer Full Screen</button>
                                            </div>
                                        )}

                                        {gameState.status === 'CHALLENGE_TARGET' && (
                                            <div className="col-span-full space-y-2 animate-in fade-in">
                                                <h3 className="text-center text-[7px] font-black text-yellow-500 uppercase">CHOOSE OPPONENT {gameState.challengeState!.count + 1}</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
                                                    {gameState.players.map(p => {
                                                        const isChallenger = p.id === gameState.currentPlayerIndex;
                                                        const alreadyChallenged = gameState.challengeState?.history.some(h => h.targetId === p.id);
                                                        const isEliminated = gameState.eliminatedPlayerIds.includes(p.id);
                                                        return (
                                                            <button 
                                                                key={p.id} 
                                                                disabled={isChallenger || alreadyChallenged || isEliminated}
                                                                onClick={() => handleChallengeTarget(p.id)}
                                                                className={`p-2 rounded-lg text-center border transition-all text-[6px] font-black uppercase ${isChallenger || alreadyChallenged || isEliminated ? 'opacity-20 border-zinc-800 cursor-not-allowed' : 'bg-zinc-800 border-zinc-700 hover:border-red-600 active:scale-95 transition-all'}`}
                                                            >
                                                                {p.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {gameState.challengeState!.count > 0 && (
                                                    <button onClick={() => setGameState(prev => ({ ...prev, status: 'CHALLENGE_FINAL' }))} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-[7px] font-black uppercase mt-1 transition-all">STOP & ANSWER NOW (MAX 30 PTS)</button>
                                                )}
                                            </div>
                                        )}

                                        {gameState.status === 'CHALLENGE_RESOLVE' && (
                                            <div className="col-span-full space-y-3 animate-in fade-in text-center">
                                                {typeof gameState.challengeState?.targetId === 'number' && (() => {
                                                    const challenge = gameState.challengeState!;
                                                    const targetPlayer = gameState.players[challenge.targetId!];
                                                    return (
                                                        <div className="space-y-3 animate-in slide-in-from-top-2">
                                                            <h3 className="text-[9px] font-black text-white uppercase italic">Challenge Round: {targetPlayer.name} is answering...</h3>
                                                            <div className="flex justify-center gap-2">
                                                                <button disabled={isActionPending} onClick={() => resolveChallenge('CORRECT')} className="bg-green-600 px-6 py-2 rounded-lg font-black uppercase text-[8px] active:scale-95 transition-all hover:bg-green-500 disabled:opacity-50">Correct (Opponent Wins)</button>
                                                                <button disabled={isActionPending} onClick={() => resolveChallenge('WRONG')} className="bg-red-600 px-6 py-2 rounded-lg font-black uppercase text-[8px] active:scale-95 transition-all hover:bg-red-500 disabled:opacity-50">Wrong</button>
                                                                <button 
                                                                  disabled={targetPlayer.passesLeft === 0 || isActionPending}
                                                                  onClick={() => resolveChallenge('PASS')} 
                                                                  className={`px-6 py-2 rounded-lg font-black uppercase text-[8px] active:scale-95 transition-all ${targetPlayer.passesLeft > 0 ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-700 cursor-not-allowed'} disabled:opacity-50`}
                                                                >
                                                                  {targetPlayer.passesLeft > 0 ? `Pass (-5) [${targetPlayer.passesLeft}]` : 'No Passes'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                {gameState.challengeState?.history.length! > 0 && gameState.challengeState?.targetId === null && (
                                                   <div className="mt-4 animate-in zoom-in">
                                                       <h3 className="text-[10px] font-black text-yellow-500 uppercase italic">SUCCESS! CHALLENGER EARNED +10 PTS BONUS</h3>
                                                       <div className="flex justify-center gap-2 mt-2">
                                                           {gameState.challengeState!.count < 2 && (
                                                               <button onClick={() => setGameState(prev => ({ ...prev, status: 'CHALLENGE_TARGET' }))} className="bg-yellow-500 text-black px-6 py-2 rounded-lg font-black uppercase text-[8px] active:scale-95 transition-all hover:bg-yellow-400">Go For Challenge 2</button>
                                                           )}
                                                           <button onClick={() => setGameState(prev => ({ ...prev, status: 'CHALLENGE_FINAL' }))} className="bg-green-600 px-6 py-2 rounded-lg font-black uppercase text-[8px] active:scale-95 transition-all hover:bg-green-500">End & Answer Final (+10)</button>
                                                       </div>
                                                   </div>
                                                )}
                                            </div>
                                        )}

                                        {gameState.status === 'CHALLENGE_FINAL' && (
                                            <div className="col-span-full space-y-3 animate-in fade-in text-center">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-[10px] font-black text-white uppercase italic">CHALLENGER'S FINAL STAND: {current.name}</h3>
                                                    <p className="text-[6px] font-black text-yellow-500 uppercase">Challenge Success Bonuses: +{10 * gameState.challengeState!.count} | Final Answer Points: +10</p>
                                                </div>
                                                <div className="flex justify-center gap-2">
                                                    <button disabled={isActionPending} onClick={() => resolveFinalChallenger(true)} className="bg-green-600 px-8 py-3 rounded-xl font-black uppercase text-[9px] active:scale-95 transition-all hover:bg-green-500 disabled:opacity-50">CORRECT (+10)</button>
                                                    <button disabled={isActionPending} onClick={() => resolveFinalChallenger(false)} className="bg-red-600 px-8 py-3 rounded-xl font-black uppercase text-[9px] active:scale-95 transition-all hover:bg-red-500 disabled:opacity-50">WRONG (K.O. -10)</button>
                                                </div>
                                                <button onClick={showReveal} className="text-[6px] font-black text-zinc-600 uppercase underline mt-1 opacity-50 hover:opacity-100 transition-all">Reveal Answer Full Screen</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                         })}
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === '1234') {
      onLogin();
    } else {
      setError('Invalid Ring Credentials. Try Again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4 text-center">
      <div className="max-w-md w-full bg-zinc-900 border border-red-900/40 p-8 rounded-[1.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 blur-[60px] rounded-full pointer-events-none"></div>
        
        <div className="text-center space-y-2 mb-8 relative z-10">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">Know or <span className="text-red-600">Knockout</span></h1>
          <p className="text-zinc-500 uppercase font-black tracking-[0.3em] text-[7px] italic">HOST AUTHENTICATION</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div className="space-y-1">
            <label className="text-[6px] font-black text-zinc-500 uppercase tracking-widest block text-left ml-1">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-xs font-bold text-white focus:border-red-600 outline-none transition-all shadow-inner"
              placeholder="admin"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[6px] font-black text-zinc-500 uppercase tracking-widest block text-left ml-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-xs font-bold text-white focus:border-red-600 outline-none transition-all shadow-inner"
              placeholder="••••"
            />
          </div>

          {error && <p className="text-red-500 text-[7px] font-black uppercase text-center animate-bounce">{error}</p>}

          <button 
            type="submit" 
            className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl text-sm uppercase tracking-tighter transition-all hover:scale-[1.02] active:scale-95 shadow-xl mt-4"
          >
            Enter the Ring 🥊
          </button>
        </form>
      </div>
    </div>
  );
}

function SetupScreen({ onStart }: { onStart: (players: Player[]) => void }) {
  const [playerNames, setPlayerNames] = useState<string[]>(Array.from({ length: 10 }, (_, i) => `Player ${i + 1}`));

  const addPlayer = () => {
    setPlayerNames(prev => [...prev, `Player ${prev.length + 1}`]);
  };

  const removePlayer = (index: number) => {
    if (playerNames.length <= 2) return;
    setPlayerNames(prev => prev.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    const players: Player[] = playerNames.map((name, i) => ({
      id: i,
      name: name.trim() || `Player ${i + 1}`,
      score: 0,
      passesLeft: 2,
      wrongAnswers: 0,
      totalPassesUsed: 0,
    }));
    onStart(players);
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-zinc-100">
      <div className="max-w-2xl w-full bg-zinc-900 border-2 border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl">
        <h2 className="text-3xl font-black italic uppercase mb-8 text-center text-red-600">Match Settings</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar p-1">
            {playerNames.map((n, i) => (
              <div key={i} className="group relative">
                <input
                  type="text"
                  value={n}
                  onChange={(e) => {
                    const newNames = [...playerNames];
                    newNames[i] = e.target.value;
                    setPlayerNames(newNames);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-3 text-[10px] font-bold uppercase tracking-tight focus:border-red-600 outline-none transition-all text-white text-center shadow-inner"
                />
                <button 
                  onClick={() => removePlayer(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <span className="absolute left-1 bottom-1 text-[5px] font-black text-zinc-700 tracking-tighter">FIGHTER {i+1}</span>
              </div>
            ))}
            
            <button 
              onClick={addPlayer}
              className="border-2 border-dashed border-zinc-800 rounded-lg flex flex-col items-center justify-center p-2 hover:border-red-600 hover:bg-zinc-800 transition-all group aspect-square min-h-[60px]"
            >
              <span className="text-2xl font-black text-zinc-700 group-hover:text-red-600">+</span>
              <span className="text-[6px] font-black text-zinc-700 uppercase group-hover:text-red-600">Add Fighter</span>
            </button>
          </div>

          <button 
            onClick={handleStart}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest mt-4 shadow-xl active:scale-95 transition-transform"
          >
            Lock Names & Start Bout
          </button>
        </div>
      </div>
    </div>
  );
}

function WinnerScreen({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.wrongAnswers !== b.wrongAnswers) return a.wrongAnswers - b.wrongAnswers;
    return a.totalPassesUsed - b.totalPassesUsed;
  });
  const winner = sorted[0];

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 text-zinc-100">
      <div className="max-w-2xl w-full text-center space-y-8 animate-in zoom-in duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-500 blur-[100px] opacity-20 rounded-full animate-pulse"></div>
          <span className="text-[12px] font-black text-yellow-500 uppercase tracking-[0.8em] mb-4 block">TOURNAMENT CHAMPION</span>
          <h1 className="text-7xl font-black italic text-white uppercase tracking-tighter leading-none mb-4 drop-shadow-2xl">{winner.name}</h1>
          <div className="text-4xl font-black text-yellow-500 italic mb-12">{winner.score} PTS</div>
        </div>

        <div className="bg-zinc-900 border-2 border-zinc-800 p-6 rounded-[2rem] shadow-2xl">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6">FINAL RANKINGS</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
            {sorted.map((p, idx) => (
              <div key={p.id} className={`flex justify-between items-center p-4 rounded-xl border ${idx === 0 ? 'bg-yellow-500/10 border-yellow-500' : 'bg-zinc-950 border-zinc-800'}`}>
                <div className="flex items-center gap-4">
                  <span className={`text-xl font-black ${idx === 0 ? 'text-yellow-500' : 'text-zinc-600'}`}>#{idx + 1}</span>
                  <span className="text-sm font-black uppercase text-white">{p.name}</span>
                </div>
                <div className="text-right">
                   <div className="text-lg font-black text-white">{p.score}</div>
                   <div className="text-[6px] font-bold text-zinc-500 uppercase italic">{p.wrongAnswers} KO's • {p.totalPassesUsed} Passes</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="bg-white text-black font-black px-12 py-4 rounded-full text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl"
        >
          New Tournament
        </button>
      </div>
    </div>
  );
}

function Scoreboard({ players, currentIndex, isArenaSpecial }: { players: Player[], currentIndex: number, isArenaSpecial?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[1.2rem] p-3 flex-1 overflow-y-auto custom-scrollbar">
      <h3 className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-3 text-center border-b border-zinc-800 pb-2">SCOREBOARD</h3>
      <div className="space-y-1.5">
        {players.map((p, idx) => {
          const isCurrent = idx === currentIndex && !isArenaSpecial;
          return (
            <div 
              key={p.id} 
              className={`p-2.5 rounded-xl border transition-all duration-300 flex flex-col gap-1 ${
                isCurrent 
                  ? 'bg-red-600 border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.3)] scale-105' 
                  : 'bg-zinc-950 border-zinc-800 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-[8px] font-black uppercase tracking-tight truncate max-w-[70%] ${isCurrent ? 'text-white' : 'text-zinc-400'}`}>
                  {p.name}
                </span>
                <span className={`text-[10px] font-black italic ${isCurrent ? 'text-white' : 'text-red-600'}`}>
                  {p.score}
                </span>
              </div>
              <div className="flex justify-between items-center text-[5px] font-bold uppercase tracking-widest">
                <span className={isCurrent ? 'text-red-200' : 'text-zinc-600'}>
                   PASSES: {p.passesLeft}
                </span>
                <span className={isCurrent ? 'text-red-200' : 'text-zinc-600'}>
                   WRONG: {p.wrongAnswers}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
