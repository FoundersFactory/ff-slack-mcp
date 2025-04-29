//Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

const openAIHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
};

interface SearchResult {
    doc: string;
    score: number;
}

//Vector search embedder
async function embed(text: string): Promise<number[]> {
    console.time("[RAG] Embedding generation");
    const apiUrl = 'https://api.openai.com/v1/embeddings';
    const requestBody = {
        input: text,
        model: 'text-embedding-3-small',
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: openAIHeaders,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch embeddings');
        }

        const data = await response.json();
        console.timeEnd("[RAG] Embedding generation");
        return data.data[0].embedding;
    } catch (error) {
        console.error("[RAG] Error generating embeddings:", error);
        throw error;
    }
}

export async function getRAGContext(message: string): Promise<string> {
    console.log(`[RAG] Starting vector search for message: ${message.substring(0, 50)}...`);
    
    if (!OPENAI_API_KEY || !MONGO_CONNECTION_STRING || !MONGO_DB_NAME || !MONGO_COLLECTION_NAME) {
        throw new Error("Missing required environment variables");
    }

    const client = new MongoClient(MONGO_CONNECTION_STRING);
    
    try {
        console.time("[RAG] MongoDB connection");
        await client.connect();
        console.timeEnd("[RAG] MongoDB connection");

        console.time("[RAG] Vector search");
        const collection = client.db(MONGO_DB_NAME).collection(MONGO_COLLECTION_NAME);
        
        const agg = [
            {
                '$vectorSearch': {
                    'index': 'vector_index',
                    'path': 'embedding',
                    'queryVector': await embed(message),
                    'numCandidates': 100,
                    'limit': 2
                }
            },
            {
                '$project': {
                    '_id': 0,
                    'doc': 1,
                    'score': {
                        '$meta': 'vectorSearchScore'
                    }
                }
            }
        ];

        const cursor = await collection.aggregate<SearchResult>(agg);
        const searchResults = await cursor.toArray();
        
        console.timeEnd("[RAG] Vector search");
        console.log(`[RAG] Found ${searchResults.length} relevant documents`);
        
        return searchResults.map(result => result.doc).join('\n\n');
    } catch (error) {
        console.error("[RAG] Error during vector search:", error);
        throw error;
    } finally {
        console.time("[RAG] MongoDB cleanup");
        await client.close();
        console.timeEnd("[RAG] MongoDB cleanup");
    }
}