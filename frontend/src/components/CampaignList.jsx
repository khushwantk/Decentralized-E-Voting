import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://127.0.0.1:5001";

const CampaignList = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch(`${API_URL}/campaigns`);
        const data = await response.json();
        setCampaigns(data.campaigns.sort((a, b) => b.id - a.id) || []);
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      }
      setIsLoading(false);
    };
    fetchCampaigns();
  }, []);

  if (isLoading) return <p>Loading campaigns...</p>;

  return (
    <div className="card">
      <h2>Available Voting Campaigns</h2>
      {campaigns.length === 0 ? (
        <p>No campaigns found. An admin needs to create one.</p>
      ) : (
        <div className="campaign-list">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="campaign-item">
              <div className="campaign-details">
                <h3>{campaign.name}</h3>
                <span
                  className={`status-badge ${
                    campaign.is_active ? "active" : "ended"
                  }`}
                >
                  {campaign.is_active ? "Active" : "Ended"}
                </span>
              </div>
              <div className="campaign-actions">
                <Link
                  to={`/campaign/${campaign.id}`}
                  className="btn btn-primary"
                >
                  Vote
                </Link>
                <Link
                  to={`/campaign/${campaign.id}/results`}
                  className="btn btn-secondary"
                >
                  View Results
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default CampaignList;
