# Sniffles core-lambda

The code for the lambda that filters Kinesis messages and publishes them to SNS.

```sh
yarn install
yarn test
yarn build
yarn package
RESOURCES_S3_BUCKET="some-bucket" SLACK_LAMBDA_S3_KEY="lambdas/v1/core.zip" yarn upload
```
