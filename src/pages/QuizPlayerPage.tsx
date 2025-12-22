import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../service/supabase';
import type { Quiz, Player, PlayerAnswer, Question } from '../../types';
import { GameState, QuestionType } from '../../types';
import { PageLoader } from '../components/PageLoader';
import { IntermediateLeaderboard } from '../components/IntermediateLeaderboard';
import { ClanBattleIntro } from '../components/ClanBattleIntro';
import { ClanBattleVsAnimation } from '../components/ClanBattleVsAnimation';
import { playSound } from '../utils/audio';
import { getUniqueMessage } from '../utils/messages';
import { PlayerQuestionActive } from '../components/PlayerQuestionActive';
import { PlayerQuestionResult } from '../components/PlayerQuestionResult';

const QuizPlayerPage = () => {
  const { quizId, playerId } = useParams<{ quizId: string; playerId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const [submittedAnswer, setSubmittedAnswer] =
    useState<PlayerAnswer['answer'] | null>(null);
  const [hasActuallyAnswered, setHasActuallyAnswered] = useState(false);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [currentResultMessage, setCurrentResultMessage] = useState('');

  const localQuestionStartTimeRef = useRef<number | null>(null);

  /* ---------------- FETCH PLAYERS ---------------- */
  const fetchPlayers = async () => {
    if (!quizId) return;

    const { data } = await supabase
      .from('quiz_players')
      .select('*')
      .eq('quiz_id', quizId);

    if (!data) return;

    const mapped = data.map(p => ({
      id: p.player_id,
      name: p.player_name,
      avatar: p.avatar,
      score: p.score,
      clan: p.clan,
      answers: [],
    }));

    setAllPlayers(mapped);

    const current = mapped.find(p => p.id === playerId);
    if (current) setPlayer(current);
  };

  /* ---------------- FETCH QUIZ ---------------- */
  const fetchQuizData = async () => {
    if (!quizId) return;

    const { data: qData } = await supabase
      .from('quiz_master_structure')
      .select('*')
      .eq('quiz_id', quizId)
      .single();

    const { data: qsData } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('question_order', { ascending: true });

    if (!qData || !qsData) return;

    const mappedQuestions: Question[] = qsData.map(q => ({
      id: String(q.pk_id),
      text: q.question_text,
      options: [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean),
      correctAnswerIndex: q.correct_answer_index,
      timeLimit: q.time_limit,
      type: q.type as QuestionType,
      technology: q.technology,
      skill: q.skill,
    }));

    setQuiz({
      id: qData.quiz_id,
      title: qData.title,
      gameState: qData.game_state,
      currentQuestionIndex: qData.current_question_index ?? 0,
      questions: mappedQuestions,
      config: {
        clanBased: qData.clan_based,
        showQuestionToPlayers: qData.show_question_to_players,
      },
    } as Quiz);
  };

  /* ---------------- INITIAL LOAD + REALTIME ---------------- */
  useEffect(() => {
    if (!quizId || !playerId) {
      navigate(`/join/${quizId}`);
      return;
    }

    fetchQuizData();
    fetchPlayers();

    const channel = supabase
      .channel(`player-room-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_master_structure',
          filter: `quiz_id=eq.${quizId}`,
        },
        async () => {
          await fetchQuizData();
          setHasActuallyAnswered(false);
          setIsAnswerLocked(false);
          setSubmittedAnswer(null);
          localQuestionStartTimeRef.current = null;
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_players',
          filter: `quiz_id=eq.${quizId}`,
        },
        fetchPlayers
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, playerId, navigate]);

  /* ---------------- TIMER RESET ---------------- */
  useEffect(() => {
    if (quiz?.gameState === GameState.QUESTION_ACTIVE) {
      localQuestionStartTimeRef.current = Date.now();
    }
  }, [quiz?.gameState]);

  /* ---------------- GUARDS ---------------- */
  if (!quiz || !player) {
    return <PageLoader message="Connecting to quiz..." />;
  }

  const question = quiz.questions?.[quiz.currentQuestionIndex];
  if (!question && quiz.gameState !== GameState.LEADERBOARD) {
    return <PageLoader message="Preparing question..." />;
  }

  /* ---------------- SUBMIT ANSWER ---------------- */
  const submitAnswer = useCallback(
    async (answerPayload: any) => {
      if (
        isAnswerLocked ||
        hasActuallyAnswered ||
        !localQuestionStartTimeRef.current ||
        !quizId ||
        !playerId ||
        !question
      )
        return;

      setIsAnswerLocked(true);
      setSubmittedAnswer(answerPayload);
      playSound('survey');

      const timeTaken =
        (Date.now() - localQuestionStartTimeRef.current) / 1000;

      let score = 0;
      let isCorrect = false;

      if (question.type === QuestionType.MCQ) {
        isCorrect = answerPayload === question.correctAnswerIndex;
        if (isCorrect) {
          score = Math.round(
            1000 +
              Math.max(
                0,
                (1 - timeTaken / question.timeLimit) * 1000
              )
          );
        }
      }

      const { error } = await supabase.from('quiz_answers').insert({
        quiz_id: quizId,
        player_id: playerId,
        question_id: question.id,
        answer: answerPayload,
        time_taken: timeTaken,
        score,
      });

      if (!error) {
        await supabase.rpc('increment_player_score', {
          p_player_id: playerId,
          p_quiz_id: quizId,
          p_score_increment: score,
        });

        setHasActuallyAnswered(true);
        setLastScore(score);
        setCurrentResultMessage(getUniqueMessage(isCorrect));
      }
    },
    [quizId, playerId, question, isAnswerLocked, hasActuallyAnswered]
  );

  /* ---------------- RENDER ---------------- */
  const renderContent = () => {
    // RESULT SCREEN FIRST
    if (
      quiz.gameState === GameState.QUESTION_RESULT ||
      hasActuallyAnswered
    ) {
      return (
        <PlayerQuestionResult
          question={question}
          isCorrect={lastScore > 0}
          correctMatchesCount={0}
          currentResultMessage={currentResultMessage}
          lifelineEarned={null}
          setLifelineEarned={() => {}}
        />
      );
    }

    switch (quiz.gameState) {
      case GameState.CLAN_BATTLE_VS:
        return <ClanBattleVsAnimation quiz={quiz} />;

      case GameState.CLAN_BATTLE_INTRO:
        return (
          <ClanBattleIntro
            quiz={quiz}
            players={allPlayers}
            playerId={playerId}
          />
        );

      case GameState.LEADERBOARD:
        return (
          <div className="p-8">
            <IntermediateLeaderboard
              players={allPlayers}
              quiz={quiz}
              highlightPlayerId={playerId}
              animate
            />
          </div>
        );

      default:
        return (
          <PlayerQuestionActive
            quiz={quiz}
            player={player}
            question={question}
            allPlayers={allPlayers}
            submitAnswer={submitAnswer}
            lifelineUsedThisTurn={null}
            eliminatedOptions={[]}
            handleLifelineClick={() => {}}
            isUsingLifeline={false}
            canUseFiftyFifty={false}
            canUsePointDoubler={false}
            fiftyFiftyCost={0}
            confirmingLifeline={null}
            setConfirmingLifeline={() => {}}
            handleUseLifeline={() => {}}
          />
        );
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-50">
      {renderContent()}
    </div>
  );
};

export default QuizPlayerPage;
