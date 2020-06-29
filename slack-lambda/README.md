# Sniffles slack-lambda

The code for the lambda that takes SNS-messages and posts them to Slack.

```sh
yarn install
yarn test
yarn build
yarn package
RESOURCES_S3_BUCKET="some-bucket" SLACK_LAMBDA_S3_KEY="lambdas/v1/slack.zip" yarn upload
```
