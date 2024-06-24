# InsertCoin

InsertCoin is a space to empower gamers and their communities to crowdfund their events.  

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup and Installation](#setup-and-installation)
  - [Bot](#bot)
  - [Server](#server)
- [Running the Project](#running-the-project)
  - [Running the Bot](#running-the-bot)
  - [Running the Server](#running-the-server)
- [Project Components](#project-components)

## Project Structure

```
InsertCoin
├─ README.md
├─ bot
│  ├─ .env
│  ├─ APICounter.py
│  ├─ config_strings.py
│  ├─ contractABI.json
│  ├─ lib.py
│  ├─ main.py
│  └─ requirements.txt
├─ contracts
│  └─ InsertCoin.sol
└─ server
   ├─ .env
   ├─ .gcloudignore
   ├─ app.yaml
   ├─ main.py
   ├─ requirements.txt
   └─ static
      ├─ contractABI.js
      ├─ js
      │  └─ contractABI.js
      └─ lobby.html
```

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Python 3.8 or higher
- Google Cloud SDK (for deploying the server)

## Setup and Installation

### Bot

1. **Navigate to the bot directory:**

   ```bash
   cd InsertCoin/bot
   ```

2. **Create a virtual environment and activate it:**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
   ```

3. **Install the required dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   - Update the `.env` with your configuration details.

### Server

1. **Navigate to the server directory:**

   ```bash
   cd InsertCoin/server
   ```

2. **Create a virtual environment and activate it:**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
   ```

3. **Install the required dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**

   - Update `.env` with your configuration details.

## Running the Project

### Running the Bot

1. **Ensure you are in the bot directory and the virtual environment is activated:**

   ```bash
   cd InsertCoin/bot
   source venv/bin/activate  # If not already activated
   ```

2. **Run the bot:**
   ```bash
   python main.py
   ```

### Running the Server

1. **Ensure you are in the server directory and the virtual environment is activated:**

   ```bash
   cd InsertCoin/server
   source venv/bin/activate  # If not already activated
   ```

2. **Run the server locally:**

   ```bash
   python main.py
   ```

3. **Deploy the server to Google Cloud:**
   - Ensure you are logged in to your Google Cloud account and have initialized the Google Cloud SDK.
   - Deploy the application:
     ```bash
     gcloud app deploy
     ```

## Project Components

### Bot

- **APICounter.py:** Manages API call counts.
- **config_strings.py:** Configuration strings used in the bot.
- **contractABI.json:** ABI for interacting with the smart contract.
- **lib.py:** Library functions used in the bot.
- **main.py:** Main entry point for running the bot.
- **requirements.txt:** Python dependencies for the bot.

### Server

- **app.yaml:** Configuration file for Google App Engine.
- **main.py:** Main entry point for the server application.
- **static:** Contains static files for the frontend.
  - **contractABI.js:** JavaScript version of the contract ABI.
  - **lobby.html:** HTML file for the lobby page.
- **requirements.txt:** Python dependencies for the server.

### Contracts

- **InsertCoin.sol:** Solidity smart contract code for InsertCoin.

