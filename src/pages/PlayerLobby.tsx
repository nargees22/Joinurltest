import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Quiz, Player } from '../../types.ts';
import { GameState, Clan } from '../../types.ts';
import { PageLoader } from '../components/PageLoader';
import { FiftyFiftyIcon } from '../icons/FiftyFiftyIcon';
import { PointDoublerIcon } from '../icons/PointDoublerIcon';
import Card from '../components/Card';
import { supabase } from '../service/supabase';

const PlayerLobby = () => {
  // 🔹 ROUTER
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  // 🔹 VALIDATE QUIZ ID FIRST
  if (!quizId || quizId.length !== 6) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500 text-lg font-semibold">
          Invalid Quiz Code
        </div>
      </div>
    );
  }

  // 🔹 GET PLAYER ID (ONLY FROM localStorage)
  const playerId = useMemo(() => {
    return localStorage.getItem(`quiz-player-${quizId}`);
  }, [quizId]);

  // 🚨 GUARD: PLAYER MUST EXIST
  if (!playerId) {
    navigate(`/join/${quizId}`);
    return null;
  }

  // 🔹 STATE
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const currentPlayer = useMemo(
    () => allPlayers.find(p => p.id === playerId),
    [allPlayers, playerId]
  );

  // 🔹 FETCH QUIZ + AUTO REDIRECT WHEN HOST STARTS
  useEffect(() => {
    const fetchQuiz = async () => {
      const { data, error } = await supabase
        .from('quiz_master_structure')
        .select(`
          id:quiz_id,
          game_state,
          clan_based,
          titan_name,
          defender_name
        `)
        .eq('quiz_id', quizId)
        .single();

      if (error || !data) {
        console.error('Quiz fetch failed', error);
        navigate(`/join/${quizId}`);
        return;
      }

      setQuiz({
        id: data.id,
        gameState: data.game_state,
        config: {
          clanBased: data.clan_based,
          clanNames: {
            [Clan.TITANS]: data.titan_name || 'Titans',
            [Clan.DEFENDERS]: data.defender_name || 'Defenders',
          },
        },
      } as Quiz);

      // 🚀 AUTO REDIRECT WHEN HOST STARTS
      if (data.game_state !== GameState.LOBBY) {
        navigate(`/quiz/player/${quizId}/${playerId}`);
      }
    };

    fetchQuiz();

    const channel = supabase
      .channel(`player-lobby-quiz-${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_master_structure',
          filter: `quiz_id=eq.${quizId}`,
        },
        fetchQuiz
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId, playerId, navigate]);

  // 🔹 REALTIME PLAYERS LIST
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('quiz_players')
        .select(`player_id, player_name, clan, avatar`)
        .eq('quiz_id', quizId);

      if (!data) return;

      setAllPlayers(
        data.map(p => ({
          id: p.player_id,
          name: p.player_name,
          clan: p.clan,
          avatar: p.avatar,
        }))
      );
    };

    fetchPlayers();

    const channel = supabase
      .channel(`player-lobby-players-${quizId}`)
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
  }, [quizId]);

  // 🔹 LOADING STATE
  if (!quiz) {
    return <PageLoader message="Joining lobby..." />;
  }

  // 🔹 NON-CLAN MODE UI
  if (!quiz.config?.clanBased) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-4 text-center animate-fade-in">
        <h1 className="text-4xl font-bold">You're in!</h1>
        <p className="text-slate-600 text-xl mt-2 mb-6">
          See your name on the host's screen.
        </p>
        <div className="text-2xl font-semibold bg-white shadow-lg p-8 rounded-2xl">
          Get ready to play...
        </div>
      </div>
    );
  }

  // 🔹 CLAN UI
  const clanColors = {
    header: {
      [Clan.TITANS]: 'bg-red-100 text-red-800',
      [Clan.DEFENDERS]: 'bg-blue-100 text-blue-800',
    },
    border: {
      [Clan.TITANS]: 'border-red-500',
      [Clan.DEFENDERS]: 'border-blue-500',
    },
  };

  const PlayerDesk: React.FC<{ player: Player }> = ({ player }) => (
    <div className="flex flex-col items-center animate-pop-in">
      <img
        src={
          player.avatar ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.name}`
        }
        alt={player.name}
      />
      <p className="mt-1 text-xs font-semibold">{player.name}</p>
    </div>
  );

  return (
    <div className="flex-grow flex flex-col items-center p-4 text-center animate-fade-in">
      <h1 className="text-3xl font-bold mb-4">Waiting for the quiz to start…</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-6xl">
        {Object.values(Clan).map(clan => {
          const clanPlayers = allPlayers.filter(p => p.clan === clan);
          return (
            <div
              key={clan}
              className={`border-2 rounded-xl p-4 ${clanColors.border[clan]}`}
            >
              <h2 className={`font-bold p-2 rounded ${clanColors.header[clan]}`}>
                {quiz.config?.clanNames?.[clan]} ({clanPlayers.length})
              </h2>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {clanPlayers.map(p => (
                  <PlayerDesk key={p.id} player={p} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerLobby;
