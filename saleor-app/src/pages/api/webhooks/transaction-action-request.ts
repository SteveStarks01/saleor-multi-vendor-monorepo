import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { gql } from "urql";

export const transactionActionRequestWebhook = new SaleorAsyncWebhook({
  name: "Transaction Action Request",
  webhookPath: "api/webhooks/transaction-action-request",
  event: "TRANSACTION_ACTION_REQUEST",
  apl: require("@/saleor-app").saleorApp.apl,
  query: gql`
    subscription TransactionActionRequest {
      event {
        ... on TransactionActionRequest {
          transaction {
            id
          }
          action {
            actionType
            amount
          }
        }
      }
    }
  `,
});

export default transactionActionRequestWebhook.createHandler((req, res, ctx) => {
  const { event } = ctx.payload;
  console.log("Action request", event);
  return res.status(200).json({ result: "SUCCESS" });
});
