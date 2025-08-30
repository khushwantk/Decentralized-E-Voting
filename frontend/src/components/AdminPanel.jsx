import React, { useState, useEffect } from "react";

const API_URL = "http://127.0.0.1:5001";

const BlockchainActivityViewer = () => {
  const [chainData, setChainData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchChain = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/chain`);
        if (!response.ok) throw new Error("Failed to fetch blockchain data.");
        const data = await response.json();
        // Reverse the chain to show the newest blocks first
        setChainData(data.chain.slice().reverse());
      } catch (err) {
        setError(err.message);
      }
      setIsLoading(false);
    };
    fetchChain();
  }, []);

  if (isLoading) return <p>Loading blockchain data...</p>;
  if (error) return <p className="message error">{error}</p>;

  return (
    <div className="blockchain-viewer">
      {chainData.map((block) => (
        <details key={block.index} className="block-details">
          <summary>Block #{block.index}</summary>
          <div className="block-content">
            <p>
              <strong>Timestamp:</strong>{" "}
              {new Date(block.timestamp * 1000).toLocaleString()}
            </p>
            <p>
              <strong>Proof:</strong> {block.proof}
            </p>
            <p>
              <strong>Previous Hash:</strong> {block.previous_hash}
            </p>
            <div className="transaction-list">
              <strong>
                Transactions (
                {block.transactions.filter((tx) => tx.voter_id !== "0").length}{" "}
                Votes)
              </strong>
              {block.transactions.length > 1 ? (
                block.transactions.map(
                  (tx, index) =>
                    // Hide the mining reward transaction for clarity
                    tx.voter_id !== "0" && (
                      <div key={index} className="transaction-item">
                        Vote by '{tx.voter_id}' for '{tx.candidate}' in Campaign
                        #{tx.campaign_id}
                      </div>
                    )
                )
              ) : (
                <p>
                  <em>No user transactions in this block.</em>
                </p>
              )}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
};

const ViewRegisteredUsers = ({ apiKey }) => {
  const [userData, setUserData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!apiKey) {
      setError("API Key is missing.");
      setIsLoading(false);
      return;
    }
    const fetchUsers = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/admin/registered_users`, {
          headers: { "X-Admin-API-Key": apiKey },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch data. Check your API Key.");
        }
        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err.message);
      }
      setIsLoading(false);
    };
    fetchUsers();
  }, [apiKey]);

  if (isLoading) return <p>Loading user data...</p>;
  if (error) return <p className="message error">{error}</p>;

  return (
    <div className="user-list-container">
      {userData.map((campaign) => (
        <details key={campaign.campaign_id}>
          <summary>
            {campaign.campaign_name} ({campaign.voted_count} Voted /{" "}
            {campaign.registered_count} Registered)
          </summary>
          {campaign.voters.length > 0 ? (
            <table className="user-list-table">
              <thead>
                <tr>
                  <th>Voter ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaign.voters.map((voter, index) => (
                  <tr key={index}>
                    <td>{voter.voter_id}</td>
                    <td>{voter.name}</td>
                    <td>{voter.email}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          voter.has_voted ? "active" : "ended"
                        }`}
                      >
                        {voter.has_voted ? "Voted" : "Not Voted"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ padding: "1rem" }}>
              No users have registered for this campaign yet.
            </p>
          )}
        </details>
      ))}
    </div>
  );
};

const AdminPanel = () => {
  const [apiKey, setApiKey] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState({ text: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("create");
  const [name, setName] = useState("");
  const [candidates, setCandidates] = useState("");
  const [duration, setDuration] = useState(24);
  const [createMessage, setCreateMessage] = useState({ text: "", type: "" });
  const [mineMessage, setMineMessage] = useState({ text: "", type: "" });
  const [isMining, setIsMining] = useState(false);

  const handleVerifyKey = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthMessage({ text: "", type: "" });
    try {
      const response = await fetch(`${API_URL}/admin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (response.ok) {
        setIsAdminAuthenticated(true);
      } else {
        const data = await response.json();
        setAuthMessage({
          text: data.message || "Verification failed.",
          type: "error",
        });
      }
    } catch (error) {
      setAuthMessage({
        text: "An error occurred during verification.",
        type: "error",
      });
    }
    setIsLoading(false);
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!name || !candidates || !duration) {
      showMessage("All fields are required.", "error");
      return;
    }
    setIsLoading(true);
    const candidatesArray = candidates
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c);
    const payload = {
      name,
      candidates: candidatesArray,
      duration_hours: parseInt(duration),
    };
    try {
      const response = await fetch(`${API_URL}/campaigns/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-API-Key": apiKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setCreateMessage({
        text: data.message,
        type: response.ok ? "success" : "error",
      });
      if (response.ok) {
        setName("");
        setCandidates("");
        setDuration(24);
      }
    } catch (error) {
      setCreateMessage({ text: "An error occurred.", type: "error" });
    }
    setIsLoading(false);
  };

  const handleMine = async () => {
    setIsMining(true);
    setMineMessage({ text: "Mining new block...", type: "info" });
    try {
      const response = await fetch(`${API_URL}/mine`);
      const data = await response.json();
      const txCount =
        data.transactions?.length > 0 ? data.transactions.length - 1 : 0;
      const msg = `${data.message}. Processed ${txCount} vote(s).`;
      setMineMessage({ text: msg, type: response.ok ? "success" : "error" });
    } catch (error) {
      setMineMessage({ text: "Mining request failed.", type: "error" });
    }
    setIsMining(false);
  };

  // If not authenticated, show the login form
  if (!isAdminAuthenticated) {
    return (
      <div className="card" style={{ maxWidth: "500px", margin: "2rem auto" }}>
        <h2>Admin Access</h2>
        <p>Please enter the Admin API Key to manage campaigns.</p>
        <form onSubmit={handleVerifyKey} className="form-container">
          <div className="form-group">
            <label htmlFor="auth-apikey">Admin API Key</label>
            <input
              id="auth-apikey"
              type="password"
              className="form-input"
              placeholder="Your secret key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? "Verifying..." : "Verify & Continue"}
          </button>
        </form>
        {authMessage.text && (
          <div className={`message ${authMessage.type}`}>
            {authMessage.text}
          </div>
        )}
      </div>
    );
  }

  // If authenticated, show the full admin panel
  return (
    <div className="card">
      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === "create" ? "active" : ""}`}
          onClick={() => setActiveTab("create")}
        >
          Create & Mine
        </button>
        <button
          className={`tab-btn ${activeTab === "view" ? "active" : ""}`}
          onClick={() => setActiveTab("view")}
        >
          View Registered Users
        </button>

        <button
          className={`tab-btn ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          Blockchain Activity
        </button>
      </div>

      {activeTab === "create" && (
        <>
          <h2>Create New Voting Campaign</h2>
          <form onSubmit={handleCreateCampaign} className="form-container">
            <div className="form-group">
              <label htmlFor="c-name">Campaign Name</label>
              <input
                id="c-name"
                type="text"
                className="form-input"
                placeholder="e.g., Board Election 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="c-candidates">Candidates (comma-separated)</label>
              <textarea
                id="c-candidates"
                className="form-input"
                placeholder="e.g., Anjali Sharma, Rohan Gupta"
                value={candidates}
                onChange={(e) => setCandidates(e.target.value)}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label htmlFor="c-duration">Duration in Hours</label>
              <input
                id="c-duration"
                type="number"
                className="form-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? "Creating..." : "Create Campaign"}
            </button>
          </form>
          {createMessage.text && (
            <div className={`message ${createMessage.type}`}>
              {createMessage.text}
            </div>
          )}

          <div
            style={{
              marginTop: "2rem",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "1.5rem",
            }}
          >
            <h2>Blockchain Control</h2>
            <p>
              Clicking "Mine" will process all pending votes and add them to a
              new block on the chain.
            </p>
            <button
              onClick={handleMine}
              disabled={isMining}
              className="btn btn-tertiary"
            >
              {isMining ? "Mining..." : "Mine New Block"}
            </button>
            {mineMessage.text && (
              <div className={`message ${mineMessage.type}`}>
                {mineMessage.text}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "view" && (
        <>
          <h2>Registered Users by Campaign</h2>
          <ViewRegisteredUsers apiKey={apiKey} />
        </>
      )}

      {activeTab === "activity" && (
        <>
          <h2>Live Blockchain Activity</h2>
          <p>
            This is the raw, immutable ledger of all votes. Blocks are listed
            from newest to oldest.
          </p>
          <BlockchainActivityViewer />
        </>
      )}
    </div>
  );
};

export default AdminPanel;
