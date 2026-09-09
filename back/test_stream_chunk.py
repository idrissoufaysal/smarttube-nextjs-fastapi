import asyncio
from app.services.rag import get_llm
from langchain_core.messages import HumanMessage

async def main():
    llm = get_llm(streaming=True)
    async for chunk in llm.astream([HumanMessage(content="bonjour")]):
        print(f"Type: {type(chunk.content)} | Content: {repr(chunk.content)} | kwargs: {chunk.additional_kwargs}")

if __name__ == "__main__":
    asyncio.run(main())
