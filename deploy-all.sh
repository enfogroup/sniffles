#!/bin/sh

CONFIG_FILE="${1:-./config.sh}"
echo "using $CONFIG_FILE..."
. "$CONFIG_FILE"
if [ $? -ne 0 ]; then
  echo "Error reading config file!"
  exit 1
fi

FULL_STACK_NAME_CORE="Sniffles-Core-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_LOGSUBSCRIBER="Sniffles-LogSubscriber-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_OPSGENIE="Sniffles-Opsgenie-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_ASSETS="Sniffles-Assets"
FULL_STACK_NAME_SLACK="Sniffles-Slack-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_LOGS="Sniffles-Logs-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_CLOUDWATCH="Sniffles-Cloudwatch-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_OPSGENIE_CLOUDWATCH="Sniffles-Opsgenie-Cloudwatch-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_CHATBOT="Sniffles-Chatbot-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_CORE_LAMBDA="Sniffles-Lambda-Cloudwatch-Alarm-Core-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_SLACK_LAMBDA="Sniffles-Lambda-Cloudwatch-Alarm-Slack-$STACK_NAME_SUFFIX"
FULL_STACK_NAME_LOGSUBSCRIBER_LAMBDA="Sniffles-Lambda-Cloudwatch-Alarm-LogSubscriber-$STACK_NAME_SUFFIX"
LOG_GROUP_NAME_CORE_LAMBDA="/aws/lambda/$FULL_STACK_NAME_CORE"
FUNCTION_NAME_CORE_LAMBDA="$FULL_STACK_NAME_CORE"
LOG_GROUP_NAME_SLACK_LAMBDA="/aws/lambda/$FULL_STACK_NAME_SLACK"
FUNCTION_NAME_SLACK_LAMBDA="$FULL_STACK_NAME_SLACK"
LOG_GROUP_NAME_LOGSUBSCRIBER_LAMBDA="/aws/lambda/$FULL_STACK_NAME_LOGSUBSCRIBER"
FUNCTION_NAME_LOGSUBSCRIBER_LAMBDA="$FULL_STACK_NAME_LOGSUBSCRIBER"
EXISTING_KINESIS=""

###
# ASSETS
###

if [ "$DEPLOY_ASSETS_MODULE" = "Yes" ]; then
  if [ "$USE_EXISTING_S3_BUCKET" != "Yes" ]; then
    aws cloudformation deploy \
      --stack-name "$FULL_STACK_NAME_ASSETS" \
      --template-file ./cloudformation-templates/assets.yml \
      --parameter-overrides BucketName="$RESOURCES_S3_BUCKET" \
      --no-fail-on-empty-changeset \
      --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
  fi

  echo "Deploying assets..."
  export RESOURCES_S3_BUCKET=$RESOURCES_S3_BUCKET
  export CORE_LAMBDA_S3_KEY=$CORE_LAMBDA_S3_KEY
  export SLACK_LAMBDA_S3_KEY=$SLACK_LAMBDA_S3_KEY

  echo "Building core lambda..."
  cd core-lambda
  yarn install
  yarn test
  yarn build
  yarn package
  yarn upload
  cd ..

  echo "Building slack lambda..."
  cd slack-lambda
  yarn install
  yarn test
  yarn build
  yarn package
  yarn upload
  cd ..
fi

###
# CORE
###

if [ -z "$EXISTING_SNS" ]; then
  echo "Deploying logs topic..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_LOGS" \
    --template-file ./cloudformation-templates/topic.yml \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/

  OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$FULL_STACK_NAME_LOGS" --query "Stacks[0].Outputs" --output json | jq -r '.[] | [.OutputKey, .OutputValue] | "\(.[0])=\(.[1])"')
  eval $OUTPUTS
  # echo $SnsTopic
else
  SnsTopic="$EXISTING_SNS"
fi

if [ -n "$LOG_WHITELIST" ]; then
  echo "Setting whitelist..."
  aws ssm put-parameter \
    --name "/$WHITELIST_PATH" \
    --value "${LOG_WHITELIST}" \
    --type String \
    --overwrite > /dev/null
fi

if [ -n "$CORE_LAMBDA_S3_KEY" ]; then
  echo "Deploying core..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_CORE" \
    --template-file ./cloudformation-templates/core.yml \
    --parameter-overrides ProjectKey="$PROJECT_KEY" ErrorMessage="$ERROR_MESSAGE" WhitelistParameterStorePath="$WHITELIST_PATH" ExistingKinesisStream="$EXISTING_KINESIS" SnsTopic="$SnsTopic" S3Bucket="$RESOURCES_S3_BUCKET" S3Key="$CORE_LAMBDA_S3_KEY" \
    --no-fail-on-empty-changeset \
    --capabilities CAPABILITY_NAMED_IAM \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/

  OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$FULL_STACK_NAME_CORE" --query "Stacks[0].Outputs" --output json | jq -r '.[] | [.OutputKey, .OutputValue] | "\(.[0])=\(.[1])"')
  eval $OUTPUTS
  # echo $CloudwatchRole
  # echo $KinesisStream
fi

###
# LOGSUBSCRIBER
###

if [ -n "$LOG_GROUPS_PATH" ]; then
  if [ -n "$LOG_GROUPS_WHITELIST" ]; then
    echo "Setting log groups..."
    aws ssm put-parameter \
      --name "/$LOG_GROUPS_PATH" \
      --value "${LOG_GROUPS_WHITELIST}" \
      --type String \
      --overwrite > /dev/null
  fi

  echo "Deploying log subscriber..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_LOGSUBSCRIBER" \
    --template-file ./cloudformation-templates/log-subscriber.yml \
    --parameter-overrides CloudwatchRole="$CloudwatchRole" KinesisStream="$KinesisStream" LogGroupPatternsParameterStorePath="$LOG_GROUPS_PATH" \
    --no-fail-on-empty-changeset \
    --capabilities CAPABILITY_IAM \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi

###
# OPSGENIE
###

if [ -n "$SNS_OPSGENIE_ENDPOINT" ]; then
  echo "Deploying sns opsgenie..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_OPSGENIE" \
    --template-file ./cloudformation-templates/opsgenie.yml \
    --parameter-overrides SnsTopic="$SnsTopic" OpsgenieEndpoint="$SNS_OPSGENIE_ENDPOINT" \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi

###
# SLACK
###

if [ -n "$SLACK_CHANNEL" ]; then
  if [ -n "$SLACK_TOKEN" ]; then
    echo "Setting slack token..."
    aws ssm put-parameter \
      --name "/$SLACK_TOKEN_PATH" \
      --value "$SLACK_TOKEN" \
      --type SecureString \
      --key-id "$SLACK_TOKEN_KEY" \
      --overwrite > /dev/null
  fi

  echo "Deploying slack..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_SLACK" \
    --template-file ./cloudformation-templates/slack.yml \
    --parameter-overrides SlackChannel="$SLACK_CHANNEL" SlackParameterStoreKey="$SLACK_TOKEN_KEY" SnsTopic="$SnsTopic" SlackParameterStorePath="$SLACK_TOKEN_PATH" S3Key="$SLACK_LAMBDA_S3_KEY" S3Bucket="$RESOURCES_S3_BUCKET" \
    --no-fail-on-empty-changeset \
    --capabilities CAPABILITY_IAM \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi

###
# CLOUDWATCH
###

if [ -z "$EXISTING_CLOUDWATCH_SNS" ]; then
  echo "Deploying cloudwatch topic..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_CLOUDWATCH" \
    --template-file ./cloudformation-templates/topic.yml \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/

  OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$FULL_STACK_NAME_CLOUDWATCH" --query "Stacks[0].Outputs" --output json | jq -r '.[] | [.OutputKey, .OutputValue] | "\(.[0])=\(.[1])"')
  eval $OUTPUTS
  # echo $SnsTopic
else
  SnsTopic="$EXISTING_CLOUDWATCH_SNS"
fi

###
# OPSGENIE CLOUDWATCH
###

if [ -n "$CLOUDWATCH_OPSGENIE_ENDPOINT" ]; then
  echo "Deploying cloudwatch opsgenie..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_OPSGENIE_CLOUDWATCH" \
    --template-file ./cloudformation-templates/opsgenie.yml \
    --parameter-overrides SnsTopic="$SnsTopic" OpsgenieEndpoint="$CLOUDWATCH_OPSGENIE_ENDPOINT" \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi

###
# CHATBOT
###

if [ -n "$SLACK_CHANNEL_ID" ]; then
  echo "Deploying chatbot..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_CHATBOT" \
    --template-file ./cloudformation-templates/chatbot.yml \
    --parameter-overrides SnsTopic="$SnsTopic" SlackChannelId="$SLACK_CHANNEL_ID" SlackWorkspaceId="$SLACK_WORKSPACE_ID" \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi

###
# LAMBDA CLOUDWATCH ALARM
###

if [ -n "$CORE_LAMBDA_S3_KEY" ]; then
  echo "Deploying cloudwatch alarm core..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_CORE_LAMBDA" \
    --template-file ./cloudformation-templates/lambda-cloudwatch-alarm.yml \
    --parameter-overrides SnsTopic="$SnsTopic" LogGroupName="$LOG_GROUP_NAME_CORE_LAMBDA" FunctionName="$FUNCTION_NAME_CORE_LAMBDA" EvaluationPeriods="$EVALUATION_PERIODS" DatapointsToAlarm="$DATAPOINTS_TO_ALARM" ProjectKey="$PROJECT_KEY" \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi

if [ -n "$SLACK_CHANNEL" ]; then
  echo "Deploying cloudwatch alarm slack..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_SLACK_LAMBDA" \
    --template-file ./cloudformation-templates/lambda-cloudwatch-alarm.yml \
    --parameter-overrides SnsTopic="$SnsTopic" LogGroupName="$LOG_GROUP_NAME_SLACK_LAMBDA" FunctionName="$FUNCTION_NAME_SLACK_LAMBDA" EvaluationPeriods="$EVALUATION_PERIODS" DatapointsToAlarm="$DATAPOINTS_TO_ALARM" ProjectKey="$PROJECT_KEY" \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi

if [ -n "$LOG_GROUPS_PATH" ]; then
  echo "Deploying cloudwatch alarm log subscriber..."
  aws cloudformation deploy \
    --stack-name "$FULL_STACK_NAME_LOGSUBSCRIBER_LAMBDA" \
    --template-file ./cloudformation-templates/lambda-cloudwatch-alarm.yml \
    --parameter-overrides SnsTopic="$SnsTopic" LogGroupName="$LOG_GROUP_NAME_LOGSUBSCRIBER_LAMBDA" FunctionName="$FUNCTION_NAME_LOGSUBSCRIBER_LAMBDA" EvaluationPeriods="$EVALUATION_PERIODS" DatapointsToAlarm="$DATAPOINTS_TO_ALARM" ProjectKey="$PROJECT_KEY" \
    --no-fail-on-empty-changeset \
    --tags Project="$PROJECT" ProjectKey="$PROJECT_KEY" Account=$(aws sts get-caller-identity | jq -r '.Account') Environment="$ENVIRONMENT" CostCenter="$PROJECT" SetupRequest="$SETUP_REQUEST" SLA="$SLA" ManagedBy=cloudformation Repo=https://github.com/enfogroup/sniffles/
fi
