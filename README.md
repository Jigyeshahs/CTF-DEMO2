
# 🛡️ KEYFORGE CTF | LOCAL DEPLOYMENT GUIDE

Welcome, Operative. Follow these protocols to initialize the KeyForge CTF platform on your local workstation.

## 🛠️ PREREQUISITES
- **Node.js** (v18.0.0 or higher)
- **NPM** or **Yarn**
- **Google Gemini API Key** (Obtain from [Google AI Studio](https://aistudio.google.com/))

## 🚀 INITIALIZATION SEQUENCE

1. **Clone/Download** this directory to your local machine.
2. **Open Terminal** in the project root.
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Configure Environment Variables**:
   The platform requires an API key to power the AI Security Assistant. Set it in your terminal session:
   
   **Windows (Command Prompt):**
   ```cmd
   set API_KEY=your_gemini_api_key_here
   ```
   
   **Windows (PowerShell):**
   ```powershell
   $env:API_KEY="your_gemini_api_key_here"
   ```
   
   **Linux / macOS:**
   ```bash
   export API_KEY=your_gemini_api_key_here
   ```

5. **Launch Defense Portal**:
   ```bash
   npm run dev
   ```

6. **Access Link**:
   Open your browser to the URL provided in the terminal (usually `http://localhost:5173`).

## 💾 DATA PERSISTENCE
This version utilizes a **Local Simulated Backend**. 
- Missions, registrations, and scores are stored in your browser's `localStorage`.
- Data persists across page refreshes but is unique to your specific browser profile.
- As the Host, you can wipe the database at any time from the **OPERATIONS** panel.

## ⚠️ SECURITY WARNING
- Never commit your `API_KEY` to public repositories.
- The platform is intended for local training and club hosting.
