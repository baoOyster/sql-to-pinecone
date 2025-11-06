import {Pinecone, PineconeRecord} from "@pinecone-database/pinecone";

export interface PineconeProcessorConfig {
    apiKey: string;
}

export interface PineconeUpsertCRUD {
    upsert(inputs: Array<string>, params?: Record<string, string>): Promise<any>;
    delete(inputs: Array<string>): Promise<any>;
    get(inputs: Array<string>): Promise<any>;
}

export type RecordToEmbed = {
    id: string;
    text: string;
    metadata: Record<string, any>;
};

export interface PineconeProcessor extends PineconeUpsertCRUD {
    setApiKey(_apiKey: string): any;
    getApiKey(): string;
    getPineconeClient(): Pinecone;
    getModelName(): string;
    setModelName(_modelName: string): any;
}

export class Processor implements PineconeProcessor {
    protected namespace: string = "default";
    protected pineconeIndexName: string = "";
    private modelName = "llama-text-embed-v2";
    private pineconeClient?: Pinecone;
    private apiKey: string = process.env.PINECONE_API_KEY || "";
    protected tableName: string = "";

    constructor(config: PineconeProcessorConfig) {
        this.apiKey = config.apiKey;
        this.onInit();
    }

    private onInit() {
        try {
            this.pineconeClient = new Pinecone({
                apiKey: this.apiKey,
            });
        } catch (error) {
            console.error("Error initializing Pinecone client:", error);
        }
    }

    public setApiKey(_apiKey: string) {
        this.apiKey = _apiKey;
        this.pineconeClient = new Pinecone({
            apiKey: this.apiKey,
        });

        return this;
    }

    public getApiKey(): string {
        return this.apiKey;
    }

    public getPineconeClient(): any {
        return this.pineconeClient;
    }

    public getModelName(): string {
        return this.modelName;
    }

    public setModelName(_modelName: string) {
        this.modelName = _modelName;
        return this;
    }

    public async upsert(inputs: Array<string>, params?: Record<string, string>): Promise<any> {
        if (!this.pineconeClient) {
            throw new Error("Pinecone client is not initialized.");
        }

        const index = this.pineconeClient.Index(this.pineconeIndexName);

        const embeddings = await this.pineconeClient.inference.embed(
            this.modelName,
            inputs,
            params || {
                inputType: "passage",
                truncate: "END",
            },
        );

        let batchToEmbed: RecordToEmbed[] = [];
        const upsertBatch: PineconeRecord[] = batchToEmbed.map((record, i) => ({
            id: record.id,
            values: (embeddings.data[i] as any).values,
            metadata: record.metadata,
        }));

        const namespace = index.namespace(this.tableName);

        await namespace.upsert(upsertBatch);
    }

    public async delete(inputs: Array<string>): Promise<any> {
        if (!this.pineconeClient) {
            throw new Error("Pinecone client is not initialized.");
        }

        const index = this.pineconeClient.Index(this.pineconeIndexName);
        const namespace = index.namespace(this.tableName);

        try{
            await namespace.deleteMany(inputs);
        } catch (error) {
            console.error("Error deleting records:", error);
        }
    }

    public async get(inputs: Array<string>): Promise<any> {
        if (!this.pineconeClient) {
            throw new Error("Pinecone client is not initialized.");
        }

        const index = this.pineconeClient.Index(this.pineconeIndexName);
        const namespace = index.namespace(this.tableName);

        try {
            const result = await namespace.fetch(inputs);
            return result;
        } catch (error) {
            console.error("Error fetching records:", error);
        }
    }
}
