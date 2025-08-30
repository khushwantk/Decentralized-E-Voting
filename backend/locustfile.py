import random
from uuid import uuid4
from locust import HttpUser, task, between

# --- User 1: The Voter ---
class VotingUser(HttpUser):
    """Represents a regular voter who registers and then repeatedly votes."""
    wait_time = between(1, 3)
    host = "http://127.0.0.1:5001"
    weight = 10

    def on_start(self):
        """Called once when a Locust user starts. Used for registration."""
        self.campaign_id = 2 # ID of the campaign to vote in
#         # List of candidates in the campaign
        self.candidates = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]

        unique_id = str(uuid4())
        self.voter_id = f"locust-user-{unique_id}"
        self.email = f"locust-user-{unique_id}@example.com"
        self.password = "password123"

        self.client.post("/voters/register", json={
            "voter_id": self.voter_id,
            "name": "Locust User",
            "email": self.email,
            "campaign_id": self.campaign_id,
            "password": self.password
        })

    @task(10)
    def cast_vote(self):
        """
        Simulates a user casting a vote.
        The first attempt will be a 201 (Success).
        All subsequent attempts will be a 400 (Rejected), which we will mark as a success.
        """
        with self.client.post("/vote", json={
            "voter_id": self.voter_id,
            "password": self.password,
            "campaign_id": self.campaign_id,
            "candidate": random.choice(self.candidates)
        }, name="/vote", catch_response=True) as response:
            if response.status_code == 400:
                response.success()

    @task(1)
    def get_campaigns(self):
        """Simulates a user viewing the campaign list."""
        self.client.get("/campaigns", name="/campaigns")

# --- User 2: The Admin / Miner ---
class AdminUser(HttpUser):
    """Represents an admin who periodically mines blocks."""
    wait_time = between(5, 10)
    host = "http://127.0.0.1:5001"
    weight = 1

    @task
    def mine_blocks(self):
        self.client.get("/mine", name="/mine")
