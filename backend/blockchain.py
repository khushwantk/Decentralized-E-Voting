import hashlib
import json
from time import time
from urllib.parse import urlparse
from uuid import uuid4
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import hmac

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

from threading import Lock

load_dotenv()

app = Flask(__name__)

db_user = os.environ.get('POSTGRES_USER')
db_password = os.environ.get('POSTGRES_PASSWORD')
db_name = os.environ.get('POSTGRES_DB')
db_host = 'localhost'

app.config['SQLALCHEMY_DATABASE_URI'] = f'postgresql://{db_user}:{db_password}@{db_host}/{db_name}'

app.config['SQLALCHEMY_POOL_SIZE'] = 30
app.config['SQLALCHEMY_MAX_OVERFLOW'] = 20
app.config['SQLALCHEMY_POOL_TIMEOUT'] = 60
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)

ADMIN_API_KEY = "super-secret-key-123"

class Campaign(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    candidates = db.Column(db.String(500), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    def is_active(self):
        return self.start_time <= datetime.utcnow() <= self.end_time

class Voter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    voter_id_hash = db.Column(db.String(64), nullable=False)
    voter_id_plaintext = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaign.id'), nullable=False)
    __table_args__ = (db.UniqueConstraint('voter_id_hash', 'campaign_id', name='_voter_campaign_uc'),)

class Blockchain:
    def __init__(self):
        self.current_transactions = []
        self.chain = []
        self.nodes = set()
        self.new_block(previous_hash='1', proof=100)

    def new_block(self, proof, previous_hash):
        block = {'index': len(self.chain) + 1, 'timestamp': time(), 'transactions': self.current_transactions, 'proof': proof, 'previous_hash': previous_hash or self.hash(self.chain[-1]),}
        self.current_transactions = []
        self.chain.append(block)
        return block

    def new_transaction(self, voter_id, candidate, campaign_id):
        self.current_transactions.append({'voter_id': voter_id, 'candidate': candidate, 'campaign_id': campaign_id,})
        return self.last_block['index'] + 1

    @property
    def last_block(self):
        return self.chain[-1]

    @staticmethod
    def hash(block):
        block_string = json.dumps(block, sort_keys=True).encode()
        return hashlib.sha224(block_string).hexdigest()

    def proof_of_work(self, last_block):
        last_proof = last_block['proof']
        last_hash = self.hash(last_block)
        proof = 0
        while self.valid_proof(last_proof, proof, last_hash) is False:
            proof += 1
        return proof

    @staticmethod
    def valid_proof(last_proof, proof, last_hash):
        guess = f'{last_proof}{proof}{last_hash}'.encode()
        guess_hash = hashlib.sha224(guess).hexdigest()
        return guess_hash[:4] == "0000"

node_identifier = str(uuid4()).replace('-', '')
blockchain = Blockchain()

blockchain_lock = Lock()


def is_admin():
    provided_key = request.headers.get('X-Admin-API-Key', '').encode('utf-8')
    expected_key = ADMIN_API_KEY.encode('utf-8')
    return hmac.compare_digest(provided_key, expected_key)

@app.cli.command("init-db")
def init_db_command():
    db.create_all()
    print("Initialized the database.")

@app.route('/admin/verify', methods=['POST', 'OPTIONS'])
def verify_admin_key():
    if request.method == 'OPTIONS': return jsonify({}), 200
    values = request.get_json()
    if not values or 'apiKey' not in values: return 'Missing API key', 400
    if values['apiKey'] == ADMIN_API_KEY:
        print(f"[AUTH] Admin key verification successful.")
        return jsonify({'success': True, 'message': 'Admin key verified.'}), 200
    else:
        print(f"[AUTH] Admin key verification FAILED.")
        return jsonify({'success': False, 'message': 'Invalid Admin API Key.'}), 401

@app.route('/campaigns/new', methods=['POST', 'OPTIONS'])
def new_campaign():
    if request.method == 'OPTIONS': return jsonify({}), 200
    if not is_admin(): return jsonify({'message': 'Unauthorized: Admin API Key required'}), 401
    values = request.get_json()
    required = ['name', 'candidates', 'duration_hours']
    if not all(k in values for k in required) or not isinstance(values['candidates'], list): return 'Missing values or candidates is not a list', 400
    start_time = datetime.utcnow()
    end_time = start_time + timedelta(hours=values['duration_hours'])
    campaign = Campaign(name=values['name'], candidates=json.dumps(values['candidates']), start_time=start_time, end_time=end_time)
    db.session.add(campaign)
    db.session.commit()
    print(f"[ADMIN] New campaign created: '{campaign.name}' (ID: {campaign.id})")
    return jsonify({'message': f"Campaign '{campaign.name}' created with ID {campaign.id}"}), 201

@app.route('/campaigns', methods=['GET'])
def get_campaigns():
    campaigns = Campaign.query.all()
    output = []
    for c in campaigns:
        output.append({'id': c.id, 'name': c.name, 'candidates': json.loads(c.candidates), 'start_time': c.start_time.isoformat() + 'Z', 'end_time': c.end_time.isoformat() + 'Z', 'is_active': c.is_active()})
    return jsonify({'campaigns': output})

@app.route('/voters/register', methods=['POST', 'OPTIONS'])
def register_voter():
    if request.method == 'OPTIONS': return jsonify({}), 200
    values = request.get_json()
    required = ['voter_id', 'name', 'email', 'campaign_id', 'password']
    if not all(k in values for k in required): return 'Missing values', 400
    print(f"[INFO] Registration attempt for Voter ID '{values['voter_id']}' in Campaign ID {values['campaign_id']}.")
    campaign = Campaign.query.get(values['campaign_id'])
    if not campaign: return jsonify({'message': 'Campaign not found'}), 404
    voter_id_hash = hashlib.sha224(values['voter_id'].encode()).hexdigest()
    if Voter.query.filter_by(voter_id_hash=voter_id_hash, campaign_id=campaign.id).first():
        print(f"[REJECTED] Voter ID '{values['voter_id']}' already exists for this campaign.")
        return jsonify({'message': 'This Voter ID is already registered for this campaign'}), 400
    new_voter = Voter(voter_id_hash=voter_id_hash,voter_id_plaintext=values['voter_id'],password_hash=generate_password_hash(values['password'], method='pbkdf2:sha256'),name=values['name'],email=values['email'],campaign_id=values['campaign_id'])
    db.session.add(new_voter)
    db.session.commit()
    print(f"[SUCCESS] Voter '{values['name']}' registered successfully.")
    return jsonify({'message': f"Voter '{values['name']}' registered successfully"}), 201

@app.route('/admin/registered_users', methods=['GET'])
def get_registered_users():
    if not is_admin(): return jsonify({'message': 'Unauthorized: Admin API Key required'}), 401
    print(f"[ADMIN] Admin fetching registered user list.")
    try:
        campaigns = Campaign.query.all()
        voters = Voter.query.all()


        with blockchain_lock:
            cast_votes = set()
            for block in blockchain.chain:
                for tx in block['transactions']:
                    if 'campaign_id' in tx and 'voter_id' in tx: cast_votes.add((tx['campaign_id'], tx['voter_id']))

        voters_by_campaign = {}
        for voter in voters:
            if voter.campaign_id not in voters_by_campaign: voters_by_campaign[voter.campaign_id] = []
            has_voted = (voter.campaign_id, voter.voter_id_plaintext) in cast_votes
            voters_by_campaign[voter.campaign_id].append({'voter_id': voter.voter_id_plaintext, 'name': voter.name, 'email': voter.email, 'has_voted': has_voted})
        output = []
        for campaign in campaigns:
            registered_voters_list = voters_by_campaign.get(campaign.id, [])
            registered_count = len(registered_voters_list)
            voted_count = sum(1 for v in registered_voters_list if v['has_voted'])
            output.append({'campaign_id': campaign.id, 'campaign_name': campaign.name, 'registered_count': registered_count, 'voted_count': voted_count, 'voters': registered_voters_list})
        return jsonify(output), 200
    except Exception as e: return jsonify({'message': 'An error occurred', 'error': str(e)}), 500

@app.route('/voters/status/<int:campaign_id>/<string:voter_id>', methods=['GET'])
def get_voter_status(campaign_id, voter_id):
    voter_id_hash = hashlib.sha224(voter_id.encode()).hexdigest()
    voter = Voter.query.filter_by(voter_id_hash=voter_id_hash, campaign_id=campaign_id).first()
    if not voter:
        print(f"[INFO] Status check for '{voter_id}': Not Registered.")
        return jsonify({'status': 'not_registered'})

    with blockchain_lock:
        for block in blockchain.chain:
            for tx in block['transactions']:
                if tx.get('campaign_id') == campaign_id and tx.get('voter_id') == voter_id:
                    print(f"[INFO] Status check for '{voter_id}': Already Voted.")
                    return jsonify({'status': 'voted'})
        for tx in blockchain.current_transactions:
            if tx.get('campaign_id') == campaign_id and tx.get('voter_id') == voter_id:
                print(f"[INFO] Status check for '{voter_id}': Already Voted (Pending).")
                return jsonify({'status': 'voted'})

    print(f"[INFO] Status check for '{voter_id}': Can Vote.")
    return jsonify({'status': 'can_vote'})

@app.route('/voters/retrieve_id', methods=['POST', 'OPTIONS'])
def retrieve_voter_id():

    if request.method == 'OPTIONS': return jsonify({}), 200
    values = request.get_json()
    required = ['email', 'campaign_id']
    if not all(k in values for k in required): return 'Missing values', 400
    voter = Voter.query.filter_by(email=values['email'], campaign_id=values['campaign_id']).first()
    message = 'If a voter is registered with this email, instructions to retrieve the Voter ID have been sent.'
    if voter: print(f"[INFO] Voter ID retrieval triggered for email: {voter.email}")
    else: print(f"[INFO] Voter ID retrieval triggered for non-existent email: {values['email']}")
    return jsonify({'message': message}), 200

@app.route('/vote', methods=['POST', 'OPTIONS'])
def cast_vote():
    if request.method == 'OPTIONS': return jsonify({}), 200
    values = request.get_json()
    required = ['voter_id', 'candidate', 'campaign_id', 'password']
    if not all(k in values for k in required): return 'Missing values', 400
    print(f"[INFO] Vote attempt from '{values['voter_id']}' for candidate '{values['candidate']}'.")

    campaign = Campaign.query.get(values['campaign_id'])
    if not campaign or not campaign.is_active() or values['candidate'] not in json.loads(campaign.candidates):
        print(f"[REJECTED] Invalid campaign, not active, or invalid candidate.")
        return jsonify({'message': 'Invalid vote parameters or campaign not active.'}), 400

    voter_id_hash = hashlib.sha224(values['voter_id'].encode()).hexdigest()
    voter = Voter.query.filter_by(voter_id_hash=voter_id_hash, campaign_id=values['campaign_id']).first()

    if not voter or not check_password_hash(voter.password_hash, values['password']):
        print(f"[REJECTED] Invalid Voter ID or password for '{values['voter_id']}'.")
        return jsonify({'message': 'Invalid Voter ID or password.'}), 401

    with blockchain_lock:
        for block in blockchain.chain:
            for tx in block['transactions']:
                if tx.get('campaign_id') == campaign.id and tx.get('voter_id') == values['voter_id']:
                    print(f"[REJECTED] Double vote attempt by '{values['voter_id']}'.")
                    return jsonify({'message': 'This voter has already cast a vote in this campaign'}), 400
        for tx in blockchain.current_transactions:
            if tx.get('campaign_id') == campaign.id and tx.get('voter_id') == values['voter_id']:
                print(f"[REJECTED] Double vote attempt (pending) by '{values['voter_id']}'.")
                return jsonify({'message': 'This voter has a pending vote in this campaign'}), 400

        index = blockchain.new_transaction(values['voter_id'], values['candidate'], campaign.id)

    print(f"[SUCCESS] Vote from '{values['voter_id']}' added to transaction pool for Block {index}.")
    return jsonify({'message': f'Vote successfully cast. It will be added to Block {index}'}), 201

@app.route('/mine', methods=['GET'])
def mine():
    print("\n[INFO] Mining process started...")

    with blockchain_lock:
        last_block = blockchain.last_block
        proof = blockchain.proof_of_work(last_block)
        previous_hash = blockchain.hash(last_block)
        block = blockchain.new_block(proof, previous_hash)

    print(f"[SUCCESS] New Block {block['index']} has been forged with {len(block['transactions'])} transactions.\n")
    response = {'message': "New Block Forged", 'index': block['index'], 'transactions': block['transactions'], 'proof': block['proof'], 'previous_hash': block['previous_hash'],}
    return jsonify(response), 200

@app.route('/chain', methods=['GET'])
def full_chain():

    with blockchain_lock:
        response = {'chain': list(blockchain.chain), 'length': len(blockchain.chain)}
    return jsonify(response)

if __name__ == '__main__':
    from argparse import ArgumentParser
    parser = ArgumentParser()
    parser.add_argument('-p', '--port', default=5001, type=int, help='port to listen on')
    args = parser.parse_args()
    port = args.port
    print(f"--- E-Voting Server starting up on port {port} ---")
    app.run(host='0.0.0.0', port=port)
