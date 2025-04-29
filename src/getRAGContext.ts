//Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();
import { MongoClient } from 'mongodb';

const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

interface SearchResult {
    doc: string;
    score: number;
}

export async function getRAGContext(message: string): Promise<string> {
    console.log(`[RAG] Starting vector search for message: ${message.substring(0, 50)}...`);
    
    if (!MONGO_CONNECTION_STRING || !MONGO_DB_NAME || !MONGO_COLLECTION_NAME) {
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
                    'queryVector': message,
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