import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { gql } from "urql";

export const transactionProcessSessionWebhook = new SaleorAsyncWebhook({
  name: "Transaction Process Session",
  webhookPath: "api/webhooks/transaction-process-session",
  event: "TRANSACTION_PROCESS_SESSION",
  apl: require("@/saleor-app").saleorApp.apl,
  query: gql`
    subscription TransactionProcessSession {
      event {
        ... on TransactionProcessSession {
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

export default transactionProcessSessionWebhook.createHandler((req, res, ctx) => {
  const { event } = ctx.payload;
  console.log("Process session", event);
  return res.status(200).json({ result: "SUCCESS" });
});
