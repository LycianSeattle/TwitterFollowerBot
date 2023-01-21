import { TwitterApi } from 'twitter-api-v2';
import {QueueServiceClient } from '@azure/storage-queue';
import { odata, TableClient, TableServiceClient, TableTransaction } from "@azure/data-tables";

const followers = async function(paginationToken: string | undefined) : Promise<void> {
    const queueServiceClient = QueueServiceClient.fromConnectionString(process.env["QUEUE_STORAGE_STRING"]);
    const paginationQueue = queueServiceClient.getQueueClient(process.env["TWITTER_FOLLOWER_PAGINATION_QUEUE"]);

    paginationQueue.createIfNotExists();

    let messagePeek = await paginationQueue.peekMessages();
    if (messagePeek.peekedMessageItems.length > 0 && paginationToken === undefined)
    {
        return;
    }

    // let client = new TwitterApi({
    //     appKey: process.env["APP_ID"],
    //     appSecret: process.env["APP_SECRET"],
    //     accessToken: process.env["ACCESS_TOKEN"],
    //     accessSecret: process.env["ACCESS_SECRET"]
    // });

    let client = new TwitterApi(process.env["FOLLOWER_BEARER_TOKEN"]);

    let account = await client.v2.userByUsername(process.env["FOLLOWER_ACCOUNT"]);
    let accountId = account.data.id;

    let followers = await client.v2.followers(accountId, {
        max_results: 1000,
        pagination_token: paginationToken
    });

    const tableName = `followers`;
    const tableClient = TableClient.fromConnectionString(process.env["FOLLOWER_STORAGE_CONNECTION_STRING"], tableName);

    await tableClient.createTable();
    
    const partitionKey = "Follower";

    let existingFollowers: string[] = [];
    for await (const entity of tableClient.listEntities())
    {
        if (entity.rowKey)
        {
            existingFollowers.push(entity.rowKey);
        }
    }

    let transaction = new TableTransaction();

    const newUserQueue = queueServiceClient.getQueueClient(process.env["TWITTER_NEW_FOLLOWER_QUEUE"]);
    await newUserQueue.createIfNotExists();

    for (let i = 0; i < followers.data.length; i++)
    {
        const follower = followers.data[i];

        if (existingFollowers.includes(follower.id))
        {
            continue;
        }

        transaction.createEntity({
            partitionKey: partitionKey,
            rowKey: follower.id
        });

        newUserQueue.sendMessage(follower.id);
    }

    await tableClient.submitTransaction(transaction.actions);

    if (followers.meta.next_token)
    {
        await paginationQueue.sendMessage(followers.meta.next_token);
    }
};

export default followers;