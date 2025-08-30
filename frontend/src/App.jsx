import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import AdminPanel from "./components/AdminPanel";
import CampaignList from "./components/CampaignList";
import VotingPage from "./components/VotingPage";
import ResultsPage from "./components/ResultsPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">Home (Campaigns)</Link>
        <Link to="/admin">Admin Panel</Link>
      </nav>
      <main className="container">
        <Routes>
          <Route path="/" element={<CampaignList />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/campaign/:campaignId" element={<VotingPage />} />
          <Route
            path="/campaign/:campaignId/results"
            element={<ResultsPage />}
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
