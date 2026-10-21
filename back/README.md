# 🐍 SmartTube API (FastAPI Backend)

Backend de l'application SmartTube : pipeline RAG hybride (Pinecone + BM25 + Cohere reranker), extraction de transcriptions YouTube, génération de résumés et quiz via LLM.

## 🐳 Démarrage Rapide avec Docker (Recommandé)

Vous n'avez pas besoin d'installer Python sur votre machine pour faire tourner le backend.

```bash
# 1. Configurer vos variables d'environnement
cp .env.example .env
# Remplissez vos clés dans .env

# 2. Démarrer le conteneur Docker
docker compose up -d

# 3. Voir les logs en direct
docker compose logs -f

# 4. Arrêter le backend
docker compose down
```

L'API sera disponible sur **`http://localhost:8000`** :
- **Documentation OpenAPI (Swagger) :** `http://localhost:8000/api/docs`
- **Vérification de santé :** `http://localhost:8000/health`

---

## 💻 Démarrage Manuel en Local (sans Docker)

Si vous souhaitez exécuter le backend directement avec votre interpréteur Python :

```bash
# 1. Créer et activer un environnement virtuel
python3 -m venv .venv
source .venv/bin/activate    # Sur Windows : .venv\Scripts\activate

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Lancer le serveur avec rechargement automatique
uvicorn app.main:app --reload --port 8000
```
