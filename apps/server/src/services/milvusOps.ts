import type { MilvusClient } from "@zilliz/milvus2-sdk-node";

/** Optional db_name on most collection/data operations */
export type DbOpt = { db?: string };

function withDb<T extends object>(params: T, db?: string): T & { db_name?: string } {
  return db ? { ...params, db_name: db } : { ...params };
}

export async function listDatabases(client: MilvusClient): Promise<string[]> {
  const res = await client.listDatabases();
  return (res as { db_names?: string[] }).db_names || [];
}

export async function listCollectionNames(
  client: MilvusClient,
  db?: string
): Promise<string[]> {
  const res = await client.listCollections(
    withDb({}, db) as Parameters<MilvusClient["listCollections"]>[0]
  );
  return (res as { collection_names?: string[] }).collection_names || [];
}

export async function describeCollectionRaw(
  client: MilvusClient,
  collectionName: string,
  db?: string
) {
  return client.describeCollection(
    withDb({ collection_name: collectionName }, db) as Parameters<
      MilvusClient["describeCollection"]
    >[0]
  );
}

export async function listIndexNames(
  client: MilvusClient,
  collectionName: string,
  db?: string
): Promise<string[]> {
  const res = await client.listIndexes(
    withDb({ collection_name: collectionName }, db) as Parameters<
      MilvusClient["listIndexes"]
    >[0]
  );
  return (res as { indexes?: string[] }).indexes || [];
}

export async function describeIndexRaw(
  client: MilvusClient,
  collectionName: string,
  db?: string
) {
  return client.describeIndex(
    withDb({ collection_name: collectionName }, db) as Parameters<
      MilvusClient["describeIndex"]
    >[0]
  );
}

export async function getLoadState(
  client: MilvusClient,
  collectionName: string,
  db?: string
): Promise<string> {
  const res = await client.getLoadState(
    withDb({ collection_name: collectionName }, db) as Parameters<
      MilvusClient["getLoadState"]
    >[0]
  );
  return (res as { state?: string }).state || "Unknown";
}

export async function getRowCount(
  client: MilvusClient,
  collectionName: string,
  db?: string
): Promise<number | null> {
  const stats = await client.getCollectionStats(
    withDb({ collection_name: collectionName }, db) as Parameters<
      MilvusClient["getCollectionStats"]
    >[0]
  );
  const arr =
    (stats as { stats?: Array<{ key: string; value: string | number }> }).stats || [];
  const rowCount = Number(arr.find((s) => s.key === "row_count")?.value);
  return Number.isFinite(rowCount) ? rowCount : null;
}

export async function queryRows(
  client: MilvusClient,
  opts: {
    collectionName: string;
    filter?: string;
    limit: number;
    offset: number;
    outputFields?: string[];
    db?: string;
  }
) {
  const params = withDb(
    {
      collection_name: opts.collectionName,
      filter: opts.filter || "",
      limit: opts.limit,
      offset: opts.offset,
      output_fields: opts.outputFields?.length ? opts.outputFields : ["*"],
    },
    opts.db
  );
  return client.query(params as Parameters<MilvusClient["query"]>[0]);
}

export async function searchVectors(
  client: MilvusClient,
  opts: {
    collectionName: string;
    vector: number[];
    vectorField: string;
    topK: number;
    metricType: string;
    filter?: string;
    outputFields?: string[];
    db?: string;
  }
) {
  const base: Record<string, unknown> = {
    collection_name: opts.collectionName,
    vectors: [opts.vector],
    vector_type: 101,
    anns_field: opts.vectorField,
    limit: opts.topK,
    metric_type: opts.metricType || "COSINE",
    params: { nprobe: 16 },
    output_fields: opts.outputFields?.length ? opts.outputFields : ["*"],
    ...(opts.filter ? { filter: opts.filter } : {}),
  };
  return client.search(
    withDb(base, opts.db) as unknown as Parameters<MilvusClient["search"]>[0]
  );
}

export async function insertRows(
  client: MilvusClient,
  opts: {
    collectionName: string;
    rows: Record<string, unknown>[];
    db?: string;
  }
) {
  return client.insert(
    withDb(
      { collection_name: opts.collectionName, data: opts.rows },
      opts.db
    ) as unknown as Parameters<MilvusClient["insert"]>[0]
  );
}

export async function deleteByFilter(
  client: MilvusClient,
  opts: { collectionName: string; filter: string; db?: string }
) {
  return client.delete(
    withDb(
      { collection_name: opts.collectionName, filter: opts.filter },
      opts.db
    ) as unknown as Parameters<MilvusClient["delete"]>[0]
  );
}

export async function createVectorIndex(
  client: MilvusClient,
  opts: {
    collectionName: string;
    fieldName: string;
    indexType?: string;
    metricType?: string;
    db?: string;
  }
) {
  return client.createIndex(
    withDb(
      {
        collection_name: opts.collectionName,
        field_name: opts.fieldName,
        index_name: `${opts.fieldName}_idx`,
        index_type: opts.indexType || "AUTOINDEX",
        metric_type: opts.metricType || "COSINE",
        params: {},
      },
      opts.db
    ) as unknown as Parameters<MilvusClient["createIndex"]>[0]
  );
}

export async function loadCollection(
  client: MilvusClient,
  collectionName: string,
  db?: string
) {
  return client.loadCollection(
    withDb({ collection_name: collectionName }, db) as Parameters<
      MilvusClient["loadCollection"]
    >[0]
  );
}

export async function releaseCollection(
  client: MilvusClient,
  collectionName: string,
  db?: string
) {
  return client.releaseCollection(
    withDb({ collection_name: collectionName }, db) as Parameters<
      MilvusClient["releaseCollection"]
    >[0]
  );
}
