import { TableClient, TableTransaction } from "@azure/data-tables";
import { AzureFunction, Context } from "@azure/functions";
import { QueueServiceClient } from "@azure/storage-queue";
import { TwitterApi } from "twitter-api-v2";

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
    const queueServiceClient = QueueServiceClient.fromConnectionString(process.env["QUEUE_STORAGE_STRING"]);
    const paginationQueue = queueServiceClient.getQueueClient(process.env["TWITTER_FOLLOWER_PAGINATION_QUEUE"]);

    paginationQueue.createIfNotExists();

    let paginationTokenResponse = await paginationQueue.receiveMessages({
        numberOfMessages: 1
    });

    let paginationToken = paginationTokenResponse.receivedMessageItems.length > 0 
        ? paginationTokenResponse.receivedMessageItems[0].messageText
        : undefined;

    let client = new TwitterApi(process.env["FOLLOWER_BEARER_TOKEN"]);

    let account = await client.v2.userByUsername(process.env["FOLLOWER_ACCOUNT"]);
    let accountId = account.data.id;

    let followers = await client.v2.followers(accountId, {
        max_results: 1000,
        pagination_token: paginationToken
    });

    if (followers.errors && followers.errors.length > 0)
    {
        console.log(followers.errors);
        return;
    }

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

        if (transaction.actions.length == 100)
        {
            await tableClient.submitTransaction(transaction.actions);
            transaction = new TableTransaction();
        }

        newUserQueue.sendMessage(follower.id);
    }

    if (transaction.actions.length > 0)
    {
        await tableClient.submitTransaction(transaction.actions);
    }

    if (followers.meta.next_token)
    {
        await paginationQueue.sendMessage(followers.meta.next_token);
    }
};

export default timerTrigger;
