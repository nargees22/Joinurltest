
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../service/supabase.ts';
import type { Quiz, Player, Question } from '../../types.ts';
import { GameState, QuestionType } from '../../types.ts';
import { PageLoader } from '../components/PageLoader';
import { PersistentQRCode } from '../components/PersistentQRCode';
import { TimerCircle } from '../components/TimerCircle';
import Button from '../components/Button';
import { SurveyResultsChart } from '../components/SurveyResultsChart';
import { IntermediateLeaderboard } from '../components/IntermediateLeaderboard';

const QuizHostPage = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [currentQuestionAnswers, setCurrentQuestionAnswers] = useState<any[]>([]);
    
    const fetchData = async () => {
        if (!quizId) return;
        const { data: qData } = await supabase.from('quiz_master_structure').select('*').eq('quiz_id', quizId).single();
        const { data: qsData } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('question_order', { ascending: true });
        const { data: pData } = await supabase.from('quiz_players').select('*').eq('quiz_id', quizId);

        if (qData) {
            // Map DB questions with individual options back to UI format
            const mappedQuestions: Question[] = (qsData || []).map((q: any) => ({
                id: q.pk_id.toString(),
                text: q.question_text,
                options: [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean),
                correctAnswerIndex: q.correct_answer_index,
                timeLimit: q.time_limit,
                type: q.type as QuestionType,
                technology: q.technology,
                skill: q.skill
            }));

            setQuiz({
                id: qData.quiz_id,
                title: qData.title,
                gameState: qData.game_state,
                currentQuestionIndex: qData.current_question_index,
                questions: mappedQuestions,
                config: { 
                    clanBased: qData.clan_based, 
                    showLiveResponseCount: qData.show_live_response_count,
                    clanNames: { Titans: qData.titan_name, Defenders: qData.defender_name }
                }
            } as any);

            // Fetch answers for current question
            const currentQ = qsData?.[qData.current_question_index];
            if (currentQ) {
                const { data: aData } = await supabase.from('quiz_answers')
                    .select('*')
                    .eq('quiz_id', quizId)
                    .eq('question_id', currentQ.pk_id.toString());
                if (aData) setCurrentQuestionAnswers(aData);
            }
        }
        if (pData) {
            const mappedPlayers = pData.map(p => ({
                id: p.player_id,
                name: p.player_name,
                avatar: p.avatar,
                score: p.score,
                clan: p.clan,
                answers: [] // Answers are handled separately
            }));
            setPlayers(mappedPlayers as any);
        }
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel(`host-room-${quizId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: `quiz_id=eq.${quizId}` }, (payload) => {
                setCurrentQuestionAnswers(prev => [...prev, payload.new]);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_master_structure', filter: `quiz_id=eq.${quizId}` }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_players', filter: `quiz_id=eq.${quizId}` }, () => {
                fetchData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [quizId]);

    const updateGameState = async (newState: GameState) => {
        const updateData: any = { game_state: newState };
        if (newState === GameState.QUESTION_INTRO) {
            updateData.current_question_index = (quiz?.currentQuestionIndex || 0) + 1;
        }
        await supabase.from('quiz_master_structure').update(updateData).eq('quiz_id', quizId);
    };

    if (!quiz) return <PageLoader message="Loading host view..." />;

    const question = quiz.questions[quiz.currentQuestionIndex];
    const totalAnswers = currentQuestionAnswers.length;

    // Calculate answer distribution for the chart
    const answerCounts = useMemo(() => {
        const counts = new Array(question?.options?.length || 0).fill(0);
        currentQuestionAnswers.forEach(ans => {
            if (typeof ans.answer === 'number') counts[ans.answer]++;
        });
        return counts;
    }, [currentQuestionAnswers, question]);

    const renderContent = () => {
        switch (quiz.gameState) {
            case GameState.QUESTION_ACTIVE:
                return (
                    <div className="flex flex-col items-center animate-fade-in w-full max-w-4xl px-4">
                        <div className="flex justify-between items-center w-full mb-6">
                            <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-full px-6 py-3 text-2xl font-bold text-slate-800">
                                <span>{totalAnswers} / {players.length} Answered</span>
                            </div>
                            <TimerCircle key={question.id} duration={question.timeLimit} start={true} />
                        </div>
                        <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                            <div className="bg-slate-800 p-8 text-white text-center">
                                <h1 className="text-3xl font-bold">{question.text}</h1>
                            </div>
                            <div className="p-8 text-center text-slate-500 text-xl animate-pulse">
                                Players are locking in their answers...
                            </div>
                        </div>
                    </div>
                );
            case GameState.QUESTION_RESULT:
                return (
                    <div className="flex flex-col items-center animate-fade-in w-full max-w-4xl px-4">
                        <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden mb-8">
                             <div className="bg-slate-800 p-6 text-white text-center">
                                <p className="text-slate-400 uppercase tracking-widest text-sm mb-2">The Correct Answer was:</p>
                                <h1 className="text-3xl font-bold text-green-400">
                                    {question.options[question.correctAnswerIndex!]}
                                </h1>
                            </div>
                            <div className="p-8">
                                <SurveyResultsChart options={question.options} answerCounts={answerCounts} />
                            </div>
                        </div>
                    </div>
                );
            case GameState.LEADERBOARD:
                return <IntermediateLeaderboard players={players} quiz={quiz} animate={true} />;
            case GameState.FINISHED:
                return (
                    <div className="text-center p-12">
                        <h1 className="text-5xl font-black text-slate-800 mb-6">Quiz Complete!</h1>
                        <Button onClick={() => navigate(`/report/${quizId}`)} className="bg-gl-orange-600 w-auto px-12 text-xl">View Full Report</Button>
                    </div>
                );
            default:
                return <div className="text-center text-slate-400 italic">Transitioning to next stage...</div>;
        }
    };

    return (
        <div className="h-full flex flex-col items-center p-4">
             <PersistentQRCode quizId={quizId!} />
             <div className="flex-grow w-full flex justify-center py-4">{renderContent()}</div>
             <div className="sticky bottom-4 w-full max-w-md flex gap-4">
                 {quiz.gameState === GameState.QUESTION_ACTIVE && <Button onClick={() => updateGameState(GameState.QUESTION_RESULT)} className="bg-gl-orange-600">Stop Timer & Show Results</Button>}
                 {quiz.gameState === GameState.QUESTION_RESULT && <Button onClick={() => updateGameState(GameState.LEADERBOARD)} className="bg-slate-800">Show Leaderboard</Button>}
                 {quiz.gameState === GameState.LEADERBOARD && (
                     quiz.currentQuestionIndex < quiz.questions.length - 1 
                        ? <Button onClick={() => updateGameState(GameState.QUESTION_INTRO)} className="bg-gl-orange-600">Next Question</Button>
                        : <Button onClick={() => updateGameState(GameState.FINISHED)} className="bg-green-600">Finish Quiz</Button>
                 )}
             </div>
        </div>
    );
};

export default QuizHostPage;
