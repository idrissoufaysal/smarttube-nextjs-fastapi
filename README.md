# 🎬 SmartTube — Monorepo (Next.js & FastAPI)

SmartTube est une plateforme moderne permettant d'interagir intelligemment avec des vidéos YouTube grâce à l'Intelligence Artificielle (RAG - *Retrieval-Augmented Generation*, transcription automatique, recherche sémantique vectorielle et chat en direct).

---

## 🏗️ Architecture du Projet

Le projet est structuré sous forme de **monorepo** contenant deux applications distinctes :

```text
smarttube/
├── back/                    # 🐍 Backend Python (FastAPI, LangChain, Pinecone, RAG)
│   ├── app/
│   │   ├── api/             # Routes de l'API REST (/api/chat, /api/videos, etc.)
│   │   ├── config/          # Configuration & variables d'environnement
│   │   ├── models/          # Modèles SQLAlchemy
│   │   └── services/        # Logique RAG, Pinecone, Transcriptions, Langfuse
│   ├── pyproject.toml       # Dépendances Python / uv
│   ├── requirements.txt     # Dépendances pour Render / Docker / pip
│   └── .env.example         # Template des variables d'environnement backend
│
├── front/                   # ⚡ Frontend Next.js 16 (React 19, TypeScript, Tailwind)
│   ├── prisma/              # Schéma de base de données (Prisma ORM)
│   ├── public/              # Fichiers statiques & médias
│   ├── src/
│   │   ├── app/             # App Router Next.js (pages & routes)
│   │   └── components/      # Composants UI (Shadcn UI, Vidstack player)
│   ├── package.json         # Dépendances et scripts Node.js
│   └── .env.example         # Template des variables d'environnement frontend
│
├── .gitignore               # Configuration globale Git (protège les secrets)
└── README.md                # Documentation principale
```

---

## 🚀 Prérequis

Avant de commencer, assurez-vous d'avoir installé sur votre machine :
- **Node.js** (v20 ou supérieur) & **npm**
- **Python** (v3.12 ou supérieur)
- **Git**
- Une base de données **PostgreSQL** (ex: Supabase, Neon, Insforge ou local)
- Un compte & des clés d'API pour :
  - [Clerk](https://clerk.com) (Authentification)
  - [Pinecone](https://www.pinecone.io) (Base de données vectorielle)
  - [OpenRouter](https://openrouter.ai) ou [OpenAI](https://platform.openai.com) (Modèles LLM et embeddings)

---

## 💻 Installation & Démarrage en Local

### 1. Cloner le projet

```bash
git clone https://github.com/<votre-nom-utilisateur>/<nom-du-repo>.git
cd smarttube
```

---

### 2. Démarrer le Backend (`back`)

1. Ouvrez un terminal dans le dossier `back` :
   ```bash
   cd back
   ```

2. Créez et activez un environnement virtuel Python :
   - **Windows (PowerShell) :**
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux :**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Installez les dépendances :
   ```bash
   pip install -r requirements.txt
   ```
   *(ou avec `uv` si installé : `uv sync`)*

4. Configurez vos variables d'environnement :
   - Copiez `.env.example` vers `.env` :
     ```bash
     cp .env.example .env     # Linux/macOS
     copy .env.example .env   # Windows
     ```
   - Renseignez les variables nécessaires (`DATABASE_URL`, `PINECONE_API_KEY`, `AI_KEY`, etc.).

5. Lancez le serveur FastAPI :
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   L'API est accessible sur **`http://localhost:8000`** et la documentation interactive sur **`http://localhost:8000/api/docs`**.

---

### 3. Démarrer le Frontend (`front`)

1. Ouvrez un second terminal dans le dossier `front` :
   ```bash
   cd front
   ```

2. Installez les dépendances Node.js :
   ```bash
   npm install
   ```

3. Configurez vos variables d'environnement :
   - Copiez `.env.example` vers `.env` :
     ```bash
     cp .env.example .env     # Linux/macOS
     copy .env.example .env   # Windows
     ```
   - Vérifiez que `NEXT_PUBLIC_API_URL` pointe bien vers votre backend local :
     ```env
     NEXT_PUBLIC_API_URL=http://localhost:8000/api
     ```

4. Initialisez Prisma :
   ```bash
   npx prisma generate
   ```

5. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```
   Le frontend est accessible sur **`http://localhost:3000`**.

---

## 🌐 Guide de Déploiement Séparé

Comme le projet est un **monorepo**, nous déployons le backend et le frontend de façon découplée en ciblant un sous-dossier (`Root Directory`).

### 🅰️ Déploiement du Backend sur [Render](https://render.com)

Vous avez deux méthodes au choix : **Avec Docker (Recommandé)** ou **Avec l'environnement Python natif**.

#### Option 1 : Déploiement avec Docker (Recommandé)
1. Connectez-vous sur **Render** et cliquez sur **New +** > **Web Service**.
2. Connectez votre dépôt GitHub.
3. Configurez les options :
   - **Name** : `smarttube-api`
   - **Region** : Francfort (ou proche de votre base de données)
   - **Root Directory** : `back`
   - **Language / Runtime** : Sélectionnez **`Docker`**
   - **Dockerfile Path** : `Dockerfile` *(laisser la valeur par défaut car le Root Directory est `back`)*
4. Le build et la commande de démarrage sont gérés automatiquement via le `Dockerfile` !
5. Dans l'onglet **Environment Variables**, ajoutez vos clés secrètes (voir ci-dessous).

#### Option 2 : Déploiement Python natif (sans Docker)
1. Créez un **Web Service**, sélectionnez votre dépôt.
2. Configurez :
   - **Root Directory** : `back`
   - **Language** : `Python 3`
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

#### Variables d'environnement pour Render (Docker ou Python) :
Ajoutez ces variables dans l'onglet **Environment Variables** :
- `DATABASE_URL`
- `AI_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
   - `CLERK_SECRET_KEY`
   - `ENVIRONMENT=production`
   - `CORS_ORIGINS` : `["https://votre-app.vercel.app"]` *(l'URL Vercel de votre frontend)*
5. Cliquez sur **Deploy Web Service**.
6. Une fois déployé, notez l'URL fournie par Render (ex : `https://smarttube-api.onrender.com`).

---

### 🅱️ Déploiement du Frontend sur [Vercel](https://vercel.com)

1. Connectez-vous sur **Vercel** et cliquez sur **Add New...** > **Project**.
2. Importez votre dépôt GitHub.
3. Dans la section **Configure Project** :
   - **Root Directory** : Cliquez sur **Edit** et sélectionnez le dossier `front`.
   - **Framework Preset** : `Next.js` (détecté automatiquement).
4. Dans la section **Environment Variables**, ajoutez :
   - `NEXT_PUBLIC_API_URL` : `https://smarttube-api.onrender.com/api` *(l'URL de votre backend Render)*
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`
   - Vos autres clés frontend (AI, Pinecone, Supadata si utilisées côté front).
5. Cliquez sur **Deploy**.

---

## 🔒 Sécurité & Git

Les fichiers `.env` contenant vos clés secrètes ne doivent **jamais** être poussés sur GitHub. Le fichier `.gitignore` à la racine protège automatiquement vos identifiants. Utilisez toujours `.env.example` pour documenter les variables requises.
