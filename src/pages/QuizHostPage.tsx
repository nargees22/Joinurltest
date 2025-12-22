// import React, { useState, useEffect, useMemo } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { supabase } from '../service/supabase.ts';
// import type { Quiz, Player, Question } from '../../types.ts';
// import { GameState, QuestionType } from '../../types.ts';
// import { PageLoader } from '../components/PageLoader';
// import { PersistentQRCode } from '../components/PersistentQRCode';
// import { TimerCircle } from '../components/TimerCircle';
// import Button from '../components/Button';
// import { SurveyResultsChart } from '../components/SurveyResultsChart';
// import { IntermediateLeaderboard } from '../components/IntermediateLeaderboard';

// const QuizHostPage = () => {
//     const { quizId } = useParams<{ quizId: string }>();
//     const navigate = useNavigate();
//     const [quiz, setQuiz] = useState<Quiz | null>(null);
//     const [players, setPlayers] = useState<Player[]>([]);
//     const [currentQuestionAnswers, setCurrentQuestionAnswers] = useState<any[]>([]);
//     if (!quizId) {
//   return <PageLoader message="Invalid quiz id" />;
// }


//     // Add detailed comments, guards, and improved logic for game state updates and rendering

//     // -----------------------------
//     // FETCH DATA (SAFE)
//     // -----------------------------
//     const fetchData = async () => {
//         if (!quizId) return;

//         const { data: qData } = await supabase
//             .from('quiz_master_structure')
//             .select('*')
//             .eq('quiz_id', quizId)
//             .single();

//         const { data: qsData } = await supabase
//             .from('quiz_questions')
//             .select('*')
//             .eq('quiz_id', quizId)
//             .order('question_order', { ascending: true });

//         const { data: pData } = await supabase
//             .from('quiz_players')
//             .select('*')
//             .eq('quiz_id', quizId);

//         if (!qData || !qsData) return;

//         const mappedQuestions: Question[] = qsData.map((q: any) => ({
//             id: String(q.pk_id),
//             text: q.question_text,
//             options: [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean),
//             correctAnswerIndex: q.correct_answer_index,
//             timeLimit: q.time_limit,
//             type: q.type as QuestionType,
//             technology: q.technology || '', // Default to empty string if missing
//             skill: q.skill || '', // Default to empty string if missing
//         }));
// console.log('QUIZ DATA FROM SUPABASE', {
//   qData,
//   qsData
// });

//         setQuiz({
//             id: qData.quiz_id,
//             title: qData.title,
//             gameState: qData.game_state,
//             currentQuestionIndex: qData.current_question_index ?? 0, // ✅ SAFE
//             questions: mappedQuestions,
//             config: {
//                 clanBased: qData.clan_based,
//                 showLiveResponseCount: qData.show_live_response_count,
//             },
//         } as Quiz);

//         if (pData) {
//             setPlayers(
//                 pData.map(p => ({
//                     id: p.player_id,
//                     name: p.player_name,
//                     avatar: p.avatar,
//                     score: p.score,
//                     clan: p.clan,
//                 }))
//             );
//         }
//     };

//     useEffect(() => {
//         fetchData();

//         const channel = supabase.channel(`host-room-${quizId}`)
//             .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: `quiz_id=eq.${quizId}` }, (payload) => {
//                 setCurrentQuestionAnswers(prev => [...prev, payload.new]);
//             })
//             .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_master_structure', filter: `quiz_id=eq.${quizId}` }, () => {
//                 fetchData();
//             })
//             .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_players', filter: `quiz_id=eq.${quizId}` }, () => {
//                 fetchData();
//             })
//             .subscribe();

//         return () => { supabase.removeChannel(channel); };
//     }, [quizId]);

//     // const updateGameState = async (newState: GameState) => {
//     //     const updateData: any = { game_state: newState };
//     //     if (newState === GameState.QUESTION_INTRO) {
//     //         updateData.current_question_index = (quiz?.currentQuestionIndex || 0) + 1;
//     //     }
//     //     await supabase.from('quiz_master_structure').update(updateData).eq('quiz_id', quizId);
//     // };
//     const updateGameState = async (newState: GameState) => {
//     if (!quizId || !quiz) return;

//     const updateData: any = { game_state: newState };
//      if (
//     newState === GameState.QUESTION_INTRO &&
//     quiz.gameState === GameState.LOBBY
//   ) {
//     updateData.current_question_index = 0;
//   }

//     // ✅ ONLY increment when moving AFTER leaderboard
//     if (
//         newState === GameState.QUESTION_INTRO &&
//         quiz.gameState === GameState.LEADERBOARD
//     ) {
//         updateData.current_question_index =
//             (quiz.currentQuestionIndex ?? 0) + 1;
//     }

//     await supabase
//         .from('quiz_master_structure')
//         .update(updateData)
//         .eq('quiz_id', quizId);
// };


//     // -----------------------------
//     // GUARDS (CRITICAL)
//     // -----------------------------
//     if (!quiz) return <PageLoader message="Loading host view..." />;

//    // const question = quiz.questions?.[quiz.currentQuestionIndex];
   
//    const question =
//   quiz.questions &&
//   typeof quiz.currentQuestionIndex === 'number' &&
//   quiz.currentQuestionIndex >= 0 &&
//   quiz.currentQuestionIndex < quiz.questions.length
//     ? quiz.questions[quiz.currentQuestionIndex]
//     : null;


//     if (
//         quiz.gameState !== GameState.LOBBY &&
//         quiz.gameState !== GameState.LEADERBOARD &&
//         quiz.gameState !== GameState.FINISHED &&
//         !question
//     ) {
//         return <PageLoader message="Preparing question..." />;
//     }

//     const totalAnswers = currentQuestionAnswers.length;

//     // -----------------------------
//     // SAFE useMemo
//     // -----------------------------
//     // const answerCounts = useMemo(() => {
//     //     if (!question) return [];
//     //     const counts = new Array(question.options.length).fill(0);
//     //     currentQuestionAnswers.forEach(a => {
//     //         if (typeof a.answer === 'number') counts[a.answer]++;
//     //     });
//     //     return counts;
//     // }, [currentQuestionAnswers, question]);
//     const answerCounts = useMemo(() => {
//   if (!question || !question.options) return [];
//   const counts = new Array(question.options.length).fill(0);
//   currentQuestionAnswers.forEach(a => {
//     if (typeof a.answer === 'number') counts[a.answer]++;
//   });
//   return counts;
// }, [currentQuestionAnswers, question]);


//     // -----------------------------
//     // RENDER
//     // -----------------------------

// const renderContent = () => {
//   if (!quiz || !Array.isArray(quiz.questions)) {
//     return <PageLoader message="Loading quiz..." />;
//   }

//   const question = quiz.questions[quiz.currentQuestionIndex];

//   switch (quiz.game_state) {
//     case GameState.QUESTION_INTRO:
//     case GameState.QUESTION_ACTIVE: {
//       if (!question) {
//         return <PageLoader message="Loading question..." />;
//       }

//       return (
//         <>
//           <TimerCircle duration={question.time_limit ?? 30} start />
//           <h1 className="text-2xl mt-6">{question.question_text}</h1>
//         </>
//       );
//     }

//     case GameState.QUESTION_RESULT: {
//       if (!question || !Array.isArray(question.options)) {
//         return <PageLoader message="Preparing results..." />;
//       }

//       return (
//         <SurveyResultsChart
//           options={question.options}
//           answerCounts={answerCounts}
//         />
//       );
//     }

//     case GameState.LEADERBOARD:
//       return <IntermediateLeaderboard players={players} quiz={quiz} animate />;

//     case GameState.FINISHED:
//       return <FinalLeaderboard players={players} quiz={quiz} />;

//     default:
//       return <PageLoader message="Loading..." />;
//   }
// };



// //     const renderContent = () => {
// //         switch (quiz.gameState) {
// //             case GameState.LOBBY:
// //                 return <div className="text-xl text-slate-500">Waiting to start quiz…</div>;

// //             // case GameState.QUESTION_INTRO:
// //             //     return (
// //             //         <div className="flex flex-col items-center animate-fade-in w-full max-w-4xl px-4">
// //             //             <div className="flex justify-between items-center w-full mb-6">
// //             //                 <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-full px-6 py-3 text-2xl font-bold text-slate-800">
// //             //                     <span>{totalAnswers} / {players.length} Answered</span>
// //             //                 </div>
// //             //                 <TimerCircle key={question.id} duration={question.timeLimit} start={true} />
// //             //             </div>
// //             //             <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
// //             //                 <div className="bg-slate-800 p-8 text-white text-center">
// //             //                     <h1 className="text-3xl font-bold">{question.text}</h1>
// //             //                 </div>
// //             //                 <div className="p-8 text-center text-slate-500 text-xl animate-pulse">
// //             //                     Players are locking in their answers...
// //             //                 </div>
// //             //             </div>
// //             //         </div>
// //             //     );
// // case GameState.QUESTION_INTRO:
// //     if (!question) {
// //         return <PageLoader message="Loading next question..." />;
// //     }

// //     return (
// //         <div className="text-center">
// //             {question && (
// //   <h1 className="text-3xl font-bold">{question.text}</h1>
// // )}

// //             <p className="mt-4 text-slate-500">Get ready…</p>
// //         </div>
// //     );

// //             case GameState.QUESTION_ACTIVE:
// //                 return (
// //                     <>
// //                         {question && (
// //   <>
// //     <TimerCircle duration={question.timeLimit} start />
// //     <h1 className="text-2xl mt-6">{question.text}</h1>
// //   </>
// // )}

// //                     </>
// //                 );

// //             case GameState.QUESTION_RESULT: {
// //   if (!question) {
// //     return <PageLoader message="Loading results..." />;
// //   }

// //   if (!Array.isArray(question.options)) {
// //     return <PageLoader message="Preparing chart..." />;
// //   }

// //   return (
// //     <SurveyResultsChart
// //       options={question.options}
// //       answerCounts={answerCounts}
// //     />
// //   );
// // }


// //             case GameState.LEADERBOARD:
// //                 return <IntermediateLeaderboard players={players} quiz={quiz} animate />;

// //             case GameState.FINISHED:
// //                 return (
// //                     <Button onClick={() => navigate(`/report/${quizId}`)}>
// //                         View Report
// //                     </Button>
// //                 );

// //             default:
// //                 return null;
// //         }
// //     };

//     return (
//         <div className="h-full flex flex-col items-center p-4">
//             <PersistentQRCode quizId={quizId!} />
//             <div className="flex-grow w-full flex justify-center py-4">{renderContent()}</div>
//             <div className="sticky bottom-4 w-full max-w-md flex gap-4">
//                 {quiz.gameState === GameState.LOBBY && (
//                     <Button
//                         onClick={() => updateGameState(GameState.QUESTION_INTRO)}
//                         className="bg-green-600"
//                     >
//                         Start Quiz
//                     </Button>
//                 )}
//                 {quiz.gameState === GameState.QUESTION_ACTIVE && <Button onClick={() => updateGameState(GameState.QUESTION_RESULT)} className="bg-gl-orange-600">Stop Timer & Show Results</Button>}
//                 {quiz.gameState === GameState.QUESTION_RESULT && <Button onClick={() => updateGameState(GameState.LEADERBOARD)} className="bg-slate-800">Show Leaderboard</Button>}
//                 {quiz.gameState === GameState.LEADERBOARD && (
//                     quiz.currentQuestionIndex < quiz.questions.length - 1
//                         ? <Button onClick={() => updateGameState(GameState.QUESTION_INTRO)} className="bg-gl-orange-600">Next Question</Button>
//                         : <Button onClick={() => updateGameState(GameState.FINISHED)} className="bg-green-600">Finish Quiz</Button>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default QuizHostPage;


import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../service/supabase';

import type { Quiz, Player, Question } from '../../types';
import { GameState, QuestionType } from '../../types';

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

  /* -------------------- SAFETY -------------------- */
  if (!quizId) {
    return <PageLoader message="Invalid quiz id" />;
  }

  /* -------------------- FETCH DATA -------------------- */
  const fetchData = async () => {
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

    const { data: pData } = await supabase
      .from('quiz_players')
      .select('*')
      .eq('quiz_id', quizId);

    if (!qData || !qsData) return;

    const mappedQuestions: Question[] = qsData.map((q: any) => ({
      id: String(q.pk_id),
      text: q.question_text,
      options: [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean),
      correctAnswerIndex: q.correct_answer_index,
      timeLimit: q.time_limit ?? 30,
      type: q.type as QuestionType,
      technology: q.technology ?? '',
      skill: q.skill ?? '',
    }));

    setQuiz({
      id: qData.quiz_id,
      title: qData.title,
      gameState: qData.game_state,
      currentQuestionIndex: qData.current_question_index ?? 0,
      questions: mappedQuestions,
      config: {
        clanBased: qData.clan_based,
        showLiveResponseCount: qData.show_live_response_count,
      },
    } as Quiz);

    if (pData) {
      setPlayers(
        pData.map((p: any) => ({
          id: p.player_id,
          name: p.player_name,
          avatar: p.avatar,
          score: p.score,
          clan: p.clan,
        }))
      );
    }
  };

  /* -------------------- REALTIME -------------------- */
  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`host-${quizId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: `quiz_id=eq.${quizId}` },
        (payload) => {
          setCurrentQuestionAnswers((prev) => [...prev, payload.new]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_master_structure', filter: `quiz_id=eq.${quizId}` },
        fetchData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId]);

  /* -------------------- GAME STATE UPDATE -------------------- */
  const updateGameState = async (newState: GameState) => {
    if (!quiz) return;

    const updateData: any = { game_state: newState };

    if (newState === GameState.QUESTION_INTRO && quiz.gameState === GameState.LEADERBOARD) {
      updateData.current_question_index = quiz.currentQuestionIndex + 1;
    }

    await supabase
      .from('quiz_master_structure')
      .update(updateData)
      .eq('quiz_id', quizId);
  };

  /* -------------------- GUARDS -------------------- */
  if (!quiz) return <PageLoader message="Loading host view..." />;

  const question = quiz.questions?.[quiz.currentQuestionIndex];

  const answerCounts = useMemo(() => {
    if (!question) return [];
    const counts = new Array(question.options.length).fill(0);
    currentQuestionAnswers.forEach((a) => {
      if (typeof a.answer === 'number') counts[a.answer]++;
    });
    return counts;
  }, [currentQuestionAnswers, question]);

  /* -------------------- RENDER -------------------- */
  const renderContent = () => {
    if (quiz.gameState === GameState.LOBBY) {
      return <div className="text-xl text-slate-500">Waiting to start quiz…</div>;
    }

    if (!question) {
      return <PageLoader message="Preparing question..." />;
    }

    switch (quiz.gameState) {
      case GameState.QUESTION_INTRO:
        return (
          <div className="text-center">
            <h1 className="text-3xl font-bold">{question.text}</h1>
            <p className="mt-4 text-slate-500">Get ready…</p>
          </div>
        );

      case GameState.QUESTION_ACTIVE:
        return (
          <>
            <TimerCircle duration={question.timeLimit} start />
            <h1 className="text-2xl mt-6">{question.text}</h1>
          </>
        );

      case GameState.QUESTION_RESULT:
        return (
          <SurveyResultsChart
            options={question.options}
            answerCounts={answerCounts}
          />
        );

      case GameState.LEADERBOARD:
        return <IntermediateLeaderboard players={players} quiz={quiz} animate />;

      case GameState.FINISHED:
        return (
          <Button onClick={() => navigate(`/report/${quizId}`)}>
            View Report
          </Button>
        );

      default:
        return <PageLoader message="Loading..." />;
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="h-full flex flex-col items-center p-4">
      <PersistentQRCode quizId={quizId} />

      <div className="flex-grow w-full flex justify-center py-4">
        {renderContent()}
      </div>

      <div className="sticky bottom-4 w-full max-w-md flex gap-4">
        {quiz.gameState === GameState.LOBBY && (
          <Button onClick={() => updateGameState(GameState.QUESTION_INTRO)} className="bg-green-600">
            Start Quiz
          </Button>
        )}

        {quiz.gameState === GameState.QUESTION_ACTIVE && (
          <Button onClick={() => updateGameState(GameState.QUESTION_RESULT)} className="bg-gl-orange-600">
            Stop Timer & Show Results
          </Button>
        )}

        {quiz.gameState === GameState.QUESTION_RESULT && (
          <Button onClick={() => updateGameState(GameState.LEADERBOARD)} className="bg-slate-800">
            Show Leaderboard
          </Button>
        )}

        {quiz.gameState === GameState.LEADERBOARD &&
          (quiz.currentQuestionIndex < quiz.questions.length - 1 ? (
            <Button onClick={() => updateGameState(GameState.QUESTION_INTRO)} className="bg-gl-orange-600">
              Next Question
            </Button>
          ) : (
            <Button onClick={() => updateGameState(GameState.FINISHED)} className="bg-green-600">
              Finish Quiz
            </Button>
          ))}
      </div>
    </div>
  );
};

export default QuizHostPage;

