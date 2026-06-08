import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { gql } from "urql";

export const transactionInitializeSessionWebhook = new SaleorAsyncWebhook({
  name: "Transaction Initialize Session",
  webhookPath: "api/webhooks/transaction-initialize-session",
  event: "TRANSACTION_INITIALIZE_SESSION",
  apl: require("@/saleor-app").saleorApp.apl,
  query: gql`
    subscription TransactionInitializeSession {
      event {
        ... on TransactionInitializeSession {
          transaction {
            id
          }
          sourceObject {
            ... on Checkout {
              id
            }
            ... on Order {
              id
            }
          }
          data
        }
      }
    }
  `,
});

export default transactionInitializeSessionWebhook.createHandler((req, res, ctx) => {
  const { event } = ctx.payload;
  console.log("Initialize session", event);
  return res.status(200).json({ result: "SUCCESS" });
});
