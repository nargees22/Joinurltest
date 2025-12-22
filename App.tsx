import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { Header } from './src/components/Header.tsx';
import { Footer } from './src/components/Footer.tsx';
import HomePage from './src/pages/HomePage.tsx';
import CreateQuizPage from './src/pages/CreateQuizPage.tsx';
import JoinQuizPage from './src/pages/JoinQuizPage.tsx';
import LobbyPage from './src/pages/LobbyPage.tsx';
import PlayerLobby from './src/pages/PlayerLobby.tsx';
import QuizHostPage from './src/pages/QuizHostPage.tsx';
import QuizPlayerPage from './src/pages/QuizPlayerPage.tsx';
import LeaderboardPage from './src/pages/LeaderboardPage.tsx';
import PerformanceReportPage from './src/pages/PerformanceReportPage.tsx';

const App = () => {
  return (
      <div className="min-h-screen flex flex-col relative">
        <div className="background-shapes"></div>
        <Header />
        <main className="flex-grow flex flex-col relative">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateQuizPage />} />
            <Route path="/join" element={<JoinQuizPage />} />
            <Route path="/join/:quizId" element={<JoinQuizPage />} />
            <Route path="/lobby/:quizId" element={<LobbyPage />} />
            <Route path="/player-lobby/:quizId" element={<PlayerLobby />} />
            <Route path="/quiz/host/:quizId" element={<QuizHostPage />} />
            <Route path="/quiz/player/:quizId/:playerId" element={<QuizPlayerPage />} />
            <Route path="/leaderboard/:quizId" element={<LeaderboardPage />} />
            <Route path="/report/:quizId" element={<PerformanceReportPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
  );
};

export default App;