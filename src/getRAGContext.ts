//Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

//Langchain packages
import {MongoDBAtlasVectorSearch} from "@langchain/mongodb";
import {MongoClient} from "mongodb";
import {OpenAIEmbeddings, ChatOpenAI} from "@langchain/openai";
import {RetrievalQAChain} from "langchain/chains";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

export async function getRAGContext(message: string): Promise<string> {
    console.log(`[RAG] Starting RAG context retrieval for message: ${message.substring(0, 50)}...`);
    
    if (!OPENAI_API_KEY || !MONGO_CONNECTION_STRING || !MONGO_DB_NAME || !MONGO_COLLECTION_NAME) {
        console.error("[RAG] Missing required environment variables");
        throw new Error("Missing required environment variables");
    }

    //Define embedding model
    console.time("[RAG] Embedding model initialization");
    const embeddings = new OpenAIEmbeddings({
        apiKey: OPENAI_API_KEY,
        batchSize: 512,
        model: "text-embedding-3-large",
    });
    console.timeEnd("[RAG] Embedding model initialization");

    //Embed docs
    console.time("[RAG] MongoDB connection");
    const client = new MongoClient(MONGO_CONNECTION_STRING);
    const collection = client.db(MONGO_DB_NAME).collection(MONGO_COLLECTION_NAME);

    try {
        await client.connect();
        console.timeEnd("[RAG] MongoDB connection");

        console.time("[RAG] Vector store initialization");
        const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection,
            indexName: "vector_index",
            textKey: "doc",
            embeddingKey: "embedding",
        });
        console.timeEnd("[RAG] Vector store initialization");

        //RAG-based search
        console.time("[RAG] RAG chain setup");
        const vectorStoreRetriever = vectorStore.asRetriever({
            k: 2
        });
        const model = new ChatOpenAI({apiKey: OPENAI_API_KEY, model: "gpt-4"});
        const chain = RetrievalQAChain.fromLLM(model, vectorStoreRetriever);
        console.timeEnd("[RAG] RAG chain setup");
        
        console.time("[RAG] Query execution");
        const res = await chain.invoke({
            query: message,
        });
        console.timeEnd("[RAG] Query execution");

        console.log(`[RAG] Successfully retrieved context of length: ${res.text.length} characters`);
        return res.text;
    } catch (error) {
        console.error("[RAG] Error during RAG context retrieval:", error);
        throw error;
    } finally {
        console.time("[RAG] MongoDB cleanup");
        await client.close();
        console.timeEnd("[RAG] MongoDB cleanup");
    }
}