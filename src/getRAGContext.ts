//Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

//Langchain packages
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

export async function getRAGContext(message: string): Promise<string> {
    if (!OPENAI_API_KEY || !MONGO_CONNECTION_STRING || !MONGO_DB_NAME || !MONGO_COLLECTION_NAME) {
        throw new Error("Missing required environment variables");
    }

    //Define embedding model
    const embeddings = new OpenAIEmbeddings({
        apiKey: OPENAI_API_KEY,
        batchSize: 512,
        model: "text-embedding-3-large",
    });

    //Embed docs
    const client = new MongoClient(MONGO_CONNECTION_STRING);
    const collection = client.db(MONGO_DB_NAME).collection(MONGO_COLLECTION_NAME);

    try {
        await client.connect();

        const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection,
            indexName: "vector_index",
            textKey: "doc",
            embeddingKey: "embedding",
        });

        //RAG-based search
        const vectorStoreRetriever = vectorStore.asRetriever();
        const model = new OpenAI({apiKey: OPENAI_API_KEY, model: "gpt-4"});
        
        const prompt = ChatPromptTemplate.fromTemplate(`Answer the following question based on the provided context:

Context: {context}

Question: {input}`);

        const documentChain = await createStuffDocumentsChain({
          llm: model,
          prompt,
        });

        const chain = await createRetrievalChain({
          retriever: vectorStoreRetriever,
          combineDocsChain: documentChain,
        });
        
        const res = await chain.invoke({
          input: message,
        });

        return res.answer;
    } finally {
        await client.close();
    }
}