import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

const API_URL = "http://127.0.0.1:5001";

const ResultsPage = () => {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [tally, setTally] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const calculateResults = async () => {
      setIsLoading(true);
      try {
        setStatusMessage("Finalizing pending votes by mining a new block...");
        await fetch(`${API_URL}/mine`);

        setStatusMessage("Tallying results from the blockchain...");
        const campaignsRes = await fetch(`${API_URL}/campaigns`);
        const campaignsData = await campaignsRes.json();
        const currentCampaign = campaignsData.campaigns.find(
          (c) => c.id === parseInt(campaignId)
        );
        if (!currentCampaign) {
          setIsLoading(false);
          return;
        }
        setCampaign(currentCampaign);

        const initialTally = currentCampaign.candidates.reduce(
          (acc, c) => ({ ...acc, [c]: 0 }),
          {}
        );

        const chainRes = await fetch(`${API_URL}/chain`);
        const chainData = await chainRes.json();

        let voteCount = 0;
        chainData.chain.forEach((block) => {
          block.transactions.forEach((tx) => {
            if (
              tx.campaign_id === parseInt(campaignId) &&
              initialTally.hasOwnProperty(tx.candidate)
            ) {
              initialTally[tx.candidate]++;
              voteCount++;
            }
          });
        });
        setTally(initialTally);
        setTotalVotes(voteCount);
      } catch (error) {
        console.error("Failed to calculate results:", error);
        setStatusMessage("Could not calculate results.");
      }
      setIsLoading(false);
      setStatusMessage("");
    };
    calculateResults();
  }, [campaignId]);

  if (isLoading)
    return (
      <div className="card">
        <p>{statusMessage || "Calculating results..."}</p>
      </div>
    );
  if (!campaign) return <p>Campaign not found.</p>;

  const winningCount = Math.max(...Object.values(tally));
  const winners = Object.keys(tally).filter(
    (c) => tally[c] === winningCount && winningCount > 0
  );

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <>
      <div className="results-header">
        <h1>{campaign.name}</h1>
        <p>
          Election Period: {formatDate(campaign.start_time)} to{" "}
          {formatDate(campaign.end_time)} IST
        </p>
      </div>

      <div className="card">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon total-votes">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="stat-card-info">
              <p>Total Votes Counted</p>
              <h3>{totalVotes}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon winner">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 18.75h-9a9 9 0 119 0zM16.5 18.75a9 9 0 00-9 0m9 0c1.657 0 3-4.03 3-9s-1.343-9-3-9-3 4.03-3 9 1.343 9 3 9z"
                />
              </svg>
            </div>
            <div className="stat-card-info">
              <p>{winners.length > 1 ? "Winners" : "Winner"}</p>
              <h3>{winners.length > 0 ? winners.join(", ") : "N/A"}</h3>
            </div>
          </div>
        </div>

        <h2>Candidate Results</h2>
        <div className="results-chart-container">
          {Object.entries(tally)
            .sort((a, b) => b[1] - a[1])
            .map(([candidate, count]) => {
              const percentage =
                totalVotes > 0 ? (count / totalVotes) * 100 : 0;
              return (
                <div key={candidate} className="result-bar-item">
                  <div className="candidate-info">
                    <span>
                      <strong>{candidate}</strong>
                    </span>
                    <span>{count} Votes</span>
                  </div>
                  <div className="bar-background">
                    <div
                      className="bar-foreground"
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 15 && `${percentage.toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        <Link
          to={`/campaign/${campaignId}`}
          className="btn btn-secondary"
          style={{
            textDecoration: "none",
            textAlign: "center",
            marginTop: "1rem",
            width: "auto",
            alignSelf: "center",
            padding: "0.75rem 2rem",
          }}
        >
          Back to Voting Page
        </Link>
      </div>
    </>
  );
};
export default ResultsPage;
