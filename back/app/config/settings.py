from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    PROJECT_NAME: str = "SmartTube API"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
    ]

    # Database (PostgreSQL)
    DATABASE_URL: str

    # AI / LLM (OpenRouter / OpenAI)
    AI_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    #OPENROUTER_MODEL: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
    OPENROUTER_MODEL: str = "google/gemini-2.5-flash"
    EMBEDDING_MODEL: str = "openai/text-embedding-3-large"
    #EMBEDDING_MODEL: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"

    # Pinecone Vector DB
    PINECONE_API_KEY: str
    PINECONE_INDEX: str = "smarttube"
    PINECONE_NAMESPACE_DEFAULT: str = "transcripts"

    # Services tiers
    SUPADATA_API_KEY: str | None = None
    CLERK_SECRET_KEY: str | None = None
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str | None = None

    # Langfuse (observabilité LLM)
    LANGFUSE_PUBLIC_KEY: str | None = None
    LANGFUSE_SECRET_KEY: str | None = None
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"
    LANGFUSE_BASE_URL: str | None = None

    @property
    def langfuse_host(self) -> str:
        """Résout l'URL de l'hôte Langfuse depuis LANGFUSE_BASE_URL ou LANGFUSE_HOST."""
        return self.LANGFUSE_BASE_URL or self.LANGFUSE_HOST

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def async_database_url(self) -> str:
        """
        Convertit l'URL postgresql:// en postgresql+asyncpg:// pour SQLAlchemy async,
        et adapte les paramètres SSL pour asyncpg (sslmode=require -> ssl=require).
        """
        url = self.DATABASE_URL.strip("'\"")
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        # asyncpg n'accepte pas 'sslmode', il utilise 'ssl'
        url = url.replace("sslmode=require", "ssl=require")
        return url


@lru_cache
def get_settings() -> Settings: 
    return Settings()


settings = get_settings()
