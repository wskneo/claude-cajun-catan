#!/bin/bash
echo "Starting the update and installation process..."

# This script assumes you have Homebrew installed for updating Node.js.

# Update Homebrew recipes
echo "Updating Homebrew..."
brew update

# Update Node.js using Homebrew
echo "Upgrading Node.js..."
brew upgrade node

# Update npm to the latest version
echo "Updating npm..."
npm install -g npm@latest

# Install or update the Google Gemini CLI
echo "Installing @google/gemini-cli..."
npm install -g @google/gemini-cli@latest

echo ""
echo "------------------------------------------------"
echo "Setup complete!"
echo "You can now use the 'gemini' command in a new terminal window."
echo "This window will close in 10 seconds."
sleep 10
