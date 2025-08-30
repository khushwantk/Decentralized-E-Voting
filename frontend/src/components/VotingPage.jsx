import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import CountdownTimer from "./CountdownTimer";

const API_URL = "http://127.0.0.1:5001";

const VotingPage = () => {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Registration form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regVoterId, setRegVoterId] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Voting form state
  const [voteVoterId, setVoteVoterId] = useState("");
  const [votePassword, setVotePassword] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [voterStatus, setVoterStatus] = useState({ status: "unchecked" });

  // Forgot ID Modal state
  const [isForgotIdModalOpen, setIsForgotIdModalOpen] = useState(false);
  const [retrievalEmail, setRetrievalEmail] = useState("");
  const [retrievalMessage, setRetrievalMessage] = useState({
    text: "",
    type: "",
  });

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        const response = await fetch(`${API_URL}/campaigns`);
        const data = await response.json();
        setCampaign(data.campaigns.find((c) => c.id === parseInt(campaignId)));
      } catch (error) {
        showMessage("Could not load campaign data.", "error");
      }
      setIsLoading(false);
    };
    fetchCampaignData();
  }, [campaignId]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    // Add password to the registration payload
    const payload = {
      name: regName,
      email: regEmail,
      voter_id: regVoterId,
      campaign_id: parseInt(campaignId),
      password: regPassword,
    };
    try {
      const response = await fetch(`${API_URL}/voters/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      showMessage(data.message, response.ok ? "success" : "error");
      if (response.ok) {
        setRegName("");
        setRegEmail("");
        setRegVoterId("");
        setRegPassword("");
      }
    } catch (err) {
      showMessage("Registration failed.", "error");
    }
    setIsLoading(false);
  };

  const handleCheckStatus = async () => {
    if (!voteVoterId) {
      showMessage("Please enter a Voter ID to check.", "error");
      return;
    }
    setVoterStatus({ status: "checking" });
    try {
      const response = await fetch(
        `${API_URL}/voters/status/${campaignId}/${voteVoterId}`
      );
      const data = await response.json();
      setVoterStatus(data);
    } catch (err) {
      showMessage("Could not check voter status.", "error");
      setVoterStatus({ status: "unchecked" });
    }
  };

  const handleVote = async (e) => {
    e.preventDefault();
    if (!selectedCandidate || !votePassword) {
      showMessage(
        "Please select a candidate and enter your password.",
        "error"
      );
      return;
    }
    setIsLoading(true);
    const payload = {
      voter_id: voteVoterId,
      candidate: selectedCandidate,
      campaign_id: parseInt(campaignId),
      password: votePassword,
    };
    try {
      const response = await fetch(`${API_URL}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      showMessage(data.message, response.ok ? "success" : "error");
      if (response.ok) {
        setVoterStatus({ status: "voted" });
      }
    } catch (err) {
      showMessage("Vote submission failed.", "error");
    }
    setIsLoading(false);
  };

  const handleRetrieveId = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/voters/retrieve_id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: retrievalEmail,
          campaign_id: parseInt(campaignId),
        }),
      });
      const data = await response.json();
      setRetrievalMessage({ text: data.message, type: "success" });
    } catch (error) {
      setRetrievalMessage({ text: "An error occurred.", type: "error" });
    }
    setIsLoading(false);
  };

  if (isLoading && !campaign) return <p>Loading Campaign...</p>;
  if (!campaign) return <p>Campaign not found.</p>;

  return (
    <>
      <div className="campaign-header">
        <h1>{campaign.name}</h1>
        <CountdownTimer endTime={campaign.end_time} />
      </div>
      {message.text && (
        <div
          className={`message ${message.type}`}
          style={{ marginBottom: "1rem" }}
        >
          {message.text}
        </div>
      )}
      <div className="grid-container">
        <fieldset disabled={!campaign.is_active || isLoading} className="card">
          <legend>
            <h2>1. Register to Vote</h2>
          </legend>
          <form onSubmit={handleRegister} className="form-container">
            <input
              className="form-input"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Full Name"
              required
            />
            <input
              className="form-input"
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="Email Address"
              required
            />
            <input
              className="form-input"
              value={regVoterId}
              onChange={(e) => setRegVoterId(e.target.value)}
              placeholder="Create a Unique Voter ID"
              required
            />
            <input
              className="form-input"
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="Create a Secure Password"
              required
            />
            <button type="submit" className="btn btn-primary">
              Register
            </button>
          </form>
        </fieldset>
        <fieldset disabled={!campaign.is_active || isLoading} className="card">
          <legend>
            <h2>2. Cast Your Vote</h2>
          </legend>
          <div className="form-container">
            <div className="form-group">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <label htmlFor="voter-id-check">Enter Your Voter ID</label>
                <button
                  onClick={() => setIsForgotIdModalOpen(true)}
                  className="forgot-id-link"
                >
                  Forgot Voter ID?
                </button>
              </div>
              <div className="input-group">
                <input
                  id="voter-id-check"
                  className="form-input"
                  value={voteVoterId}
                  onChange={(e) => {
                    setVoteVoterId(e.target.value);
                    setVoterStatus({ status: "unchecked " });
                  }}
                  placeholder="Your registered Voter ID"
                />
                <button
                  className="btn btn-check"
                  onClick={handleCheckStatus}
                  disabled={voterStatus.status === "checking"}
                >
                  Check Status
                </button>
              </div>
            </div>
            {voterStatus.status === "checking" && <p>Checking...</p>}
            {voterStatus.status === "not_registered" && (
              <p className="message error">
                This Voter ID is not registered for this campaign.
              </p>
            )}
            {voterStatus.status === "voted" && (
              <p className="message success">
                Your vote has been cast. Thank you for participating!
              </p>
            )}
            {voterStatus.status === "can_vote" && (
              <form onSubmit={handleVote}>
                <p className="message success">
                  You are eligible to vote! Please provide your password and
                  select a candidate.
                </p>
                <div className="form-group">
                  <label htmlFor="vote-password">Password</label>
                  <input
                    id="vote-password"
                    type="password"
                    className="form-input"
                    value={votePassword}
                    onChange={(e) => setVotePassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <div className="radio-group">
                  {campaign.candidates.map((candidate) => (
                    <label key={candidate} className="radio-label">
                      <input
                        type="radio"
                        name="candidate"
                        value={candidate}
                        checked={selectedCandidate === candidate}
                        onChange={(e) => setSelectedCandidate(e.target.value)}
                      />
                      <span>{candidate}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ marginTop: "1rem" }}
                >
                  Cast Final Vote
                </button>
              </form>
            )}
          </div>
        </fieldset>
      </div>
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link
          to={`/campaign/${campaign.id}/results`}
          className="btn btn-secondary"
          style={{
            textDecoration: "none",
            display: "inline-block",
            width: "auto",
          }}
        >
          View Live Results
        </Link>
      </div>
      {isForgotIdModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              onClick={() => setIsForgotIdModalOpen(false)}
              className="modal-close-btn"
            >
              &times;
            </button>
            <h2>Retrieve Your Voter ID</h2>
            <p>
              Enter the email address you registered with for this campaign.
            </p>
            <form onSubmit={handleRetrieveId} className="form-container">
              <div className="form-group">
                <label htmlFor="retrieval-email">Your Email Address</label>
                <input
                  id="retrieval-email"
                  type="email"
                  className="form-input"
                  value={retrievalEmail}
                  onChange={(e) => setRetrievalEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? "Searching..." : "Retrieve ID"}
              </button>
            </form>
            {retrievalMessage.text && (
              <div className={`message ${retrievalMessage.type}`}>
                {retrievalMessage.text}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
export default VotingPage;
